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

sub getSkinVersion { return '3.2.3' }

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

# O idioma da sessao do LMS, em duas letras maiusculas. E ele que decide em que
# lingua a skin fala -- forcar pt-BR num servidor em ingles era o que impedia a
# skin de ser publicavel fora do Brasil.
sub getLang {
	my $lang = eval { Slim::Utils::Strings::getLanguage() };
	if (!defined $lang || !length $lang) {
		$log->warn("could not read the session language, falling back to EN: $@") if $@;
		$lang = 'EN';
	}
	return uc(substr($lang, 0, 2));
}

# Codigo BCP 47 para o atributo lang do documento. Sem isso o leitor de tela
# pronuncia texto em ingles com fonemas portugueses, e vice-versa.
sub getHtmlLang {
	my %map = (PT => 'pt-BR', EN => 'en', ES => 'es', FR => 'fr', DE => 'de',
	           IT => 'it', NL => 'nl', SV => 'sv', DA => 'da', FI => 'fi',
	           NO => 'no', CS => 'cs', PL => 'pl', RU => 'ru', HE => 'he');
	my $lang = getLang();
	return $map{$lang} || lc($lang);
}

# Dicionario da interface, montado a partir do proprio strings.txt.
#
# A chave de cada entrada e a frase em portugues -- e nao um identificador --
# porque e assim que o JavaScript a encontra: o texto ja esta escrito nos
# templates e serve de chave de busca. Traduzir e acrescentar uma linha PT e a
# linha do idioma novo aqui ao lado; nenhum arquivo .js precisa mudar.
#
# Formato aceito para a linha de idioma: espaco, duas letras MAIUSCULAS, espaco,
# texto. "pt-BR", "en_US" ou "en" nao casam e a linha e ignorada -- por isso a
# colisao abaixo tambem e registrada no log, senao um erro de digitacao no
# codigo do idioma some sem deixar nada.
#
# Em portugues devolve um mapa vazio de proposito: a camada de traducao se
# desliga inteira e a skin roda como rodava antes de ela existir.
#
# Relido a cada render, com o mtime do arquivo como chave do cache: um tradutor
# edita strings.txt e recarrega a pagina, sem reiniciar o servidor, e mesmo
# assim o arquivo nao e reaberto e reprocessado em toda visita.
my %stringCache;

sub getStringMap {
	my $lang = getLang();
	return {} if $lang eq 'PT';

	my $path = eval { _pluginFile('strings.txt') };
	my $mtime = defined $path ? (stat($path))[9] : undef;

	my $hit = $stringCache{$lang};
	return $hit->{map}
		if $hit && defined $mtime && defined $hit->{mtime} && $hit->{mtime} == $mtime;

	my $map = eval { _readStringMap($lang, $path) };

	if (ref $map ne 'HASH') {
		# The interface keeps working and speaks Portuguese, which beats a blank
		# page. But an English-locale user staring at a Portuguese interface has
		# no way to find out why, and neither did anyone reading the log.
		$log->error("could not build the $lang dictionary; the interface will "
			. "stay in Portuguese: " . ($@ || 'unknown error'));
		$map = {};
	}

	$stringCache{$lang} = { mtime => $mtime, map => $map };
	return $map;
}

sub _pluginFile {
	my $me = $INC{ +MODULE_KEY };
	die "module path unknown\n" unless defined $me && length $me;
	return catfile(dirname($me), $_[0]);
}

sub _readStringMap {
	my ($lang, $path) = @_;
	die "module path unknown\n" unless defined $path;

	# Lido como bytes de proposito. strings.txt e UTF-8 e o documento que
	# recebe o mapa tambem e: passar os bytes adiante sem decodificar evita
	# a dupla codificacao que transforma "reproducao" em "reproduÃ§Ã£o".
	open(my $fh, '<', $path) or die "strings.txt unreadable: $!\n";

	my %out;
	my %origin;
	my ($key, %val);
	my $flush = sub {
		return unless defined $key && $key =~ /^ECHOCLASSIC_UI_/;
		return unless defined $val{PT} && length $val{PT};
		my $target = $val{$lang};
		$target = $val{EN} unless defined $target && length $target;
		return unless defined $target && length $target;
		return if $target eq $val{PT};

		# The map is keyed by the Portuguese phrase, so two different string
		# keys carrying the same PT text collide and the later one wins in
		# silence -- one translation simply stops appearing.
		if (exists $out{ $val{PT} } && $out{ $val{PT} } ne $target) {
			$log->warn("strings.txt: '$key' and '$origin{ $val{PT} }' share the "
				. "same PT text, so only '$key' will be used");
		}
		$out{ $val{PT} }    = $target;
		$origin{ $val{PT} } = $key;
	};

	my $first = 1;
	while (my $line = <$fh>) {
		$line =~ s/\r?\n$//;
		# A UTF-8 BOM would ride along on the first key and stop it matching
		# ECHOCLASSIC_UI_, dropping that entry without a word.
		if ($first) { $line =~ s/^\xEF\xBB\xBF//; $first = 0; }
		next if $line =~ /^\s*#/;
		if ($line =~ /^(\S+)\s*$/) { $flush->(); $key = $1; %val = (); next; }
		if ($line =~ /^\s+([A-Z]{2})\s+(.*)$/) { $val{$1} = $2; }
	}
	$flush->();
	close($fh);

	return \%out;
}

# O mapa vira literal JavaScript. Os valores vem de strings.txt, que um tradutor
# edita -- entao sao escapados como qualquer entrada externa.
sub getStringMapJson {
	my $map = getStringMap();
	my @pairs;
	for my $pt (sort keys %$map) {
		push @pairs, '"' . jsLiteral($pt) . '":"' . jsLiteral($map->{$pt}) . '"';
	}
	return '{' . join(',', @pairs) . '}';
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
