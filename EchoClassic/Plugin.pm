package Plugins::EchoClassic::Plugin;

# Skin plugin. The HTML/echoclassic tree is served by relative path because this is a
# type=2 skin and LMS resolves it through its skin manager. filltemplatefile is
# used instead of the old static-file shortcut so the page can inject server
# state through [% PERL %] and avoid a burst of API calls at start-up.
#
# Failure policy, which the whole file follows: a die inside a [% PERL %] block
# renders an EMPTY page with HTTP 200 -- no error anywhere the user can see. So
# nothing that runs during a page render is allowed to throw. Every one of those
# subs degrades to a usable fallback instead.
#
# The corollary, which this file used to get wrong: degrading quietly is not the
# same as degrading invisibly. "The interface is in Portuguese on an English
# server" and "the browser still runs last week's JavaScript" are the two
# failures a user actually reports, and both used to leave no trace at all. Every
# fallback below logs why it was taken.

use strict;
use warnings;

use base qw(Slim::Plugin::Base);

use File::Basename qw(dirname);
use File::Spec::Functions qw(catdir catfile);

use Slim::Player::Client;
use Slim::Utils::Log;
use Slim::Utils::Strings;

my $log = Slim::Utils::Log->addLogCategory({
	category     => 'plugin.echoclassic',
	defaultLevel => 'ERROR',
	description  => 'PLUGIN_ECHOCLASSIC_SKIN',
});

my $URL_RE = qr/^echoclassic(\/.*)?$/;

# The %INC key this module was loaded under. Two subs need the plugin directory
# and both used to spell this literal out; if LMS ever loads the module under a
# different key, one constant goes undef instead of two subs failing apart.
use constant MODULE_KEY => 'Plugins/EchoClassic/Plugin.pm';

# getAssetRevision walks the asset tree, and index.html calls it twice per page
# render. Without this the walk runs twice per request, and on a plugin
# directory living on a network share that is two round trips of stat() inside
# the LMS event loop. Short enough that a deploy is picked up while you are
# still reloading the page.
use constant ASSET_REV_TTL => 5;

sub initPlugin {
	my $class = shift;

	# main::WEBUI is a compile-time constant: 0 when the server is started with
	# --noweb, and 0 in the scanner process. Everything this plugin registers is
	# a web page -- the skin itself and its settings page -- so with no web
	# server there is nothing to register and nothing to register it with. Stop
	# before touching Slim::Web::*. Slim::Utils::PluginManager ignores the
	# return value; it is written out for the reader.
	return 0 unless main::WEBUI;

	# Loaded here rather than at the top of the file: under --noweb these are
	# not necessarily available, and this is the only branch that needs them.
	require Slim::Web::Pages;
	require Slim::Web::HTTP;

	$class->SUPER::initPlugin(@_);

	my $serve = sub {
		my ($client, $params) = @_;

		# The only caller of filltemplatefile, and the one place the "never die
		# during a render" rule was not actually enforced. A template error here
		# used to escape into the HTTP handler.
		my $page = eval {
			Slim::Web::HTTP::filltemplatefile('echoclassic/index.html', $params);
		};
		return $page if defined $page;

		# filltemplatefile hands back a scalar ref (Slim::Web::HTTP line 2667,
		# via _generateContentFromFile), so the fallback has to be one too --
		# and a ref to a lexical, not to a constant, since the HTTP layer is
		# free to modify what it is given.
		$log->error("could not render echoclassic/index.html: $@");
		my $empty = '';
		return \$empty;
	};

	Slim::Web::Pages->addPageFunction($URL_RE, $serve);

	# A partial or half-extracted install can leave Settings.pm missing or
	# broken. That must not take the skin down with it: the route above is
	# already registered and serves fine without a settings page.
	eval {
		require Plugins::EchoClassic::Settings;
		Plugins::EchoClassic::Settings->new();
		1;
	} or do {
		$log->error("settings page not registered: $@");
	};

	return 1;
}

sub getDisplayName { return 'ECHOCLASSIC_SKIN' }

sub getSkinVersion { return '3.2.9' }

# Escapes a value for use inside a double-quoted JavaScript string literal.
#
# Not JSON::XS, though LMS ships it: the strings this receives are raw UTF-8
# bytes, read that way on purpose by getStringMap, and encode_json would treat
# them as characters and encode them a second time -- the exact "reproducao" ->
# "reproduÃ§Ã£o" corruption the byte-level read exists to avoid. So the escaping
# is done here, over bytes.
#
# The order matters: backslash first, or the escapes introduced below get
# escaped again.
sub jsLiteral {
	my $v = defined $_[0] ? "$_[0]" : '';
	$v =~ s/([\\"])/\\$1/g;
	$v =~ s/\r/\\r/g;
	$v =~ s/\n/\\n/g;

	# U+2028 and U+2029 terminate a string literal in ES5-era parsers exactly
	# like a newline does, so one of them in strings.txt turns the injected
	# dictionary into a syntax error and the page renders blank. They arrive as
	# their UTF-8 bytes because of the byte-level read; the second pair of
	# substitutions covers the case where a decoded string reaches here instead.
	$v =~ s/\xE2\x80\xA8/\\u2028/g;
	$v =~ s/\xE2\x80\xA9/\\u2029/g;
	$v =~ s/\x{2028}/\\u2028/g;
	$v =~ s/\x{2029}/\\u2029/g;

	# Both of these end a <script> block early in an HTML parser, which ends the
	# literal somewhere the JavaScript parser was not expecting.
	$v =~ s{</}{<\\/}g;
	$v =~ s/<!--/<\\!--/g;

	return $v;
}

# LMS serves skin assets with Cache-Control: max-age=604800 — a week. Without a
# revision on every asset URL, a browser keeps last week's app.js and css after
# a reinstall, and the page silently runs half old code. This is the newest
# mtime under HTML/echoclassic, so it changes on every deploy without being bumped by
# hand.
my ($assetRev, $assetRevAt);

sub getAssetRevision {
	my $now = time;
	return $assetRev
		if defined $assetRev && defined $assetRevAt && ($now - $assetRevAt) < ASSET_REV_TTL;

	my $newest = eval { _newestAssetMtime() };

	if (!defined $newest) {
		# Falling back to the version string means the asset URLs stop changing
		# between deploys, which is precisely the week-long cache this function
		# exists to defeat. Silently is how it used to happen; the symptom -- a
		# browser running old code after an update -- is impossible to diagnose
		# from the outside, so say it out loud.
		$log->error('could not read the asset tree; asset URLs will not change '
			. 'between deploys and browsers may serve cached files: ' . ($@ || 'no readable directory'));
		$newest = getSkinVersion();
	}

	($assetRev, $assetRevAt) = ($newest, $now);
	return $newest;
}

sub _newestAssetMtime {
	my $me = $INC{ +MODULE_KEY };
	die "module path unknown\n" unless defined $me && length $me;

	my $found;
	my $read = 0;
	my %seen;
	my @dirs = (catdir(dirname($me), 'HTML', 'echoclassic'));

	while (my $dir = shift @dirs) {
		# -d follows symlinks, so a directory that links back to an ancestor
		# would be walked again. The OS symlink-depth limit does stop it
		# eventually, but only after tens of pointless directory reads, and a
		# cycle that does not involve a symlink has nothing to stop it at all.
		my ($dev, $ino) = (stat($dir))[0, 1];
		next unless defined $ino;
		next if $seen{"$dev:$ino"}++;

		opendir(my $dh, $dir) or next;
		$read++;
		for my $entry (readdir($dh)) {
			next if $entry eq '.' || $entry eq '..';
			my $path = catfile($dir, $entry);
			if (-d $path) {
				push @dirs, $path;
				next;
			}
			# defined, not ||: a file whose mtime is genuinely 0 is not the
			# same as a stat that failed, and the old code could not tell them
			# apart.
			my $mtime = (stat($path))[9];
			next unless defined $mtime;
			$found = $mtime if !defined $found || $mtime > $found;
		}
		closedir($dh);
	}

	# "Walked the tree and found no files" and "could not read the tree at all"
	# produced the same answer before, and only the second one is a fault.
	die "no readable directory under HTML/echoclassic\n" unless $read;

	return $found;
}

sub getLmsVersion {
	my $v = $::VERSION || '0.0.0';
	$v =~ s/[^0-9.].*$//;
	# The substitution can empty the string outright -- a version that does not
	# start with a digit, such as "v9.1.1", left nothing behind and the caller
	# got '' from the branch written to prevent exactly that.
	return length $v ? $v : '0.0.0';
}

# The LMS session language, as two uppercase letters. It is only the initial
# guess now: a choice made in the skin's own Settings outranks it, because a
# server running in one language is not the same thing as a person reading in
# it.
sub getLang {
	my $lang = eval { Slim::Utils::Strings::getLanguage() };
	if (!defined $lang || !length $lang) {
		$log->warn("could not read the session language, falling back to EN: $@") if $@;
		$lang = 'EN';
	}
	return uc(substr($lang, 0, 2));
}

# BCP 47 code for the document's lang attribute. Without it a screen reader
# pronounces English text with Portuguese phonemes, and the other way round.
sub getHtmlLang {
	my %map = (PT => 'pt-BR', EN => 'en', ES => 'es', FR => 'fr', DE => 'de',
	           IT => 'it', NL => 'nl', SV => 'sv', DA => 'da', FI => 'fi',
	           NO => 'no', CS => 'cs', PL => 'pl', RU => 'ru', HE => 'he');
	my $lang = getLang();
	return $map{$lang} || lc($lang);
}

# Dicionario da interface, montado a partir do proprio strings.txt.
#
# Each entry is keyed by the ENGLISH phrase -- not by an identifier -- because
# that is how the JavaScript finds it: the English text is already written in
# the templates and doubles as the lookup key. Translating means adding the new
# language's line next to it; no .js file has to change.
#
# English is the source: for it the map comes back empty on purpose, the whole
# translation layer switches off, and the skin runs with no translation cost.
#
# Accepted shape for a language line: whitespace, two UPPERCASE letters,
# whitespace, text. "pt-BR", "en_US" and "en" do not match and the line is
# ignored -- which is also why the collision below is logged, or a typo in a
# language code would vanish without a trace.
#
# Every language is sent to the page, not just the LMS session's. That is what
# lets the language be changed inside the skin's Settings with no round trip:
# the JavaScript picks the map. The cost is one copy of the dictionary per
# translated language -- one today -- and it lives and dies with the document.
#
# Re-read per render, keyed on the file's mtime: a translator edits strings.txt
# and reloads the page without restarting the server, and even so the file is
# not reopened and reparsed on every visit.
use constant SOURCE_LANG => 'EN';

my $stringCache;

# Every strings.txt entry, indexed by key and by language.
sub _entries {
	my $path = eval { _pluginFile('strings.txt') };
	my $mtime = defined $path ? (stat($path))[9] : undef;

	return $stringCache->{entries}
		if $stringCache && defined $mtime && defined $stringCache->{mtime}
			&& $stringCache->{mtime} == $mtime;

	my $entries = eval { _readEntries($path) };

	if (ref $entries ne 'HASH') {
		# The interface keeps working and speaks English, which is the source:
		# better than a blank page. But someone seeing English after choosing
		# another language has no way to find out why, and neither did anyone
		# reading the log.
		$log->error('could not read strings.txt; the interface will stay in '
			. 'English only: ' . ($@ || 'unknown error'));
		$entries = {};
	}

	$stringCache = { mtime => $mtime, entries => $entries };
	return $entries;
}

# The languages a translation exists for, source excluded, in a stable order.
sub getLanguages {
	my $entries = _entries();
	my %seen;
	for my $val (values %$entries) {
		for my $code (keys %$val) {
			next if $code eq SOURCE_LANG;
			next unless defined $val->{$code} && length $val->{$code};
			$seen{$code} = 1;
		}
	}
	return [ sort keys %seen ];
}

# Map of "English phrase" => "phrase in the requested language".
sub getStringMap {
	my $lang = uc($_[-1] || '');
	return {} if !length $lang || $lang eq SOURCE_LANG;

	my $entries = _entries();
	my (%out, %origin);

	for my $key (sort keys %$entries) {
		my $val = $entries->{$key};
		my $source = $val->{ +SOURCE_LANG };
		next unless defined $source && length $source;
		my $target = $val->{$lang};
		next unless defined $target && length $target;
		next if $target eq $source;

		# The map is keyed by the English phrase, so two keys carrying the same
		# English text collide and the later one wins in silence -- one
		# translation simply stops appearing.
		if (exists $out{$source} && $out{$source} ne $target) {
			$log->warn("strings.txt: '$key' and '$origin{$source}' share the same "
				. "$lang source text, so only '$key' will be used");
		}
		$out{$source}    = $target;
		$origin{$source} = $key;
	}

	return \%out;
}

sub _pluginFile {
	my $me = $INC{ +MODULE_KEY };
	die "module path unknown\n" unless defined $me && length $me;
	return catfile(dirname($me), $_[0]);
}

sub _readEntries {
	my ($path) = @_;
	die "module path unknown\n" unless defined $path;

	# Read as bytes on purpose. strings.txt is UTF-8 and so is the document that
	# receives the map: passing the bytes through undecoded avoids the double
	# encoding that turns "reproducao" into "reproduÃ§Ã£o".
	open(my $fh, '<', $path) or die "strings.txt unreadable: $!\n";

	my %out;
	my $key;
	my $first = 1;
	while (my $line = <$fh>) {
		$line =~ s/\r?\n$//;
		# A UTF-8 BOM would ride along on the first key and stop it matching
		# ECHOCLASSIC_UI_, dropping that entry without a word.
		if ($first) { $line =~ s/^\xEF\xBB\xBF//; $first = 0; }
		next if $line =~ /^\s*#/;
		if ($line =~ /^(\S+)\s*$/) {
			# Copied into a variable before being tested: matching $1 against
			# another pattern is a new match, and that resets the capture
			# groups -- $1 comes out undef and the whole entry is lost in
			# silence.
			my $candidate = $1;
			$key = $candidate =~ /^ECHOCLASSIC_UI_/ ? $candidate : undef;
			$out{$key} = {} if defined $key;
			next;
		}
		if (defined $key && $line =~ /^\s+([A-Z]{2})\s+(.*)$/) { $out{$key}{$1} = $2; }
	}
	close($fh);

	return \%out;
}

# The map becomes a JavaScript literal. The values come from strings.txt, which
# a translator edits -- so they are escaped like any other external input.
sub getStringMapJson {
	my $map = getStringMap($_[-1]);
	my @pairs;
	for my $source (sort keys %$map) {
		push @pairs, '"' . jsLiteral($source) . '":"' . jsLiteral($map->{$source}) . '"';
	}
	return '{' . join(',', @pairs) . '}';
}

# Every dictionary at once: { "PT": {...}, "ES": {...} }. This is what the page
# receives, so changing language in Settings does not depend on the server.
sub getStringMapsJson {
	my @langs = @{ getLanguages() };
	my @parts;
	for my $lang (@langs) {
		push @parts, '"' . jsLiteral($lang) . '":' . getStringMapJson($lang);
	}
	return '{' . join(',', @parts) . '}';
}

# The languages offered in the picker, each named in itself: someone who opened
# the skin in a language they cannot read still has to recognise their own.
sub getLanguageNamesJson {
	my %names = (EN => 'English', PT => 'Português', ES => 'Español',
	             FR => 'Français', DE => 'Deutsch', IT => 'Italiano',
	             NL => 'Nederlands', SV => 'Svenska', DA => 'Dansk',
	             FI => 'Suomi', NO => 'Norsk', CS => 'Čeština',
	             PL => 'Polski', RU => 'Русский', HE => 'עברית');
	my @parts;
	for my $lang (SOURCE_LANG, @{ getLanguages() }) {
		push @parts, '"' . jsLiteral($lang) . '":"'
			. jsLiteral($names{$lang} || $lang) . '"';
	}
	return '{' . join(',', @parts) . '}';
}

# The playerid the page should prefer on load: the first connected player, so
# the UI does not have to guess before its first serverstatus round.
sub getPlayerHint {
	# Same rule as getAssetRevision: this runs inside [% PERL %], where a die
	# renders an empty page with HTTP 200. An empty hint just means the UI
	# discovers the player itself a moment later.
	my $id = eval {
		# Sorted, because clients() returns them in hash order: with two players
		# connected the hint used to change between renders, so reloading the
		# page could hand the interface a different player each time.
		my @connected = sort grep { defined $_ && length $_ }
			map { eval { $_->connected ? $_->id : undef } } Slim::Player::Client::clients();
		$connected[0];
	};

	if (!defined $id) {
		$log->warn("could not pick a player hint: $@") if $@;
		return '';
	}
	return $id;
}

1;
