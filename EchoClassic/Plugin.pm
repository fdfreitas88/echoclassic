package Plugins::EchoClassic::Plugin;

# Skin plugin. The HTML/echoclassic tree is served by relative path because this is a
# type=2 skin and LMS resolves it through its skin manager. filltemplatefile is
# used instead of the old static-file shortcut so the page can inject server
# state through [% PERL %] and avoid a burst of API calls at start-up.

use strict;

use base qw(Slim::Plugin::Base);

use File::Basename qw(dirname);
use File::Spec::Functions qw(catdir catfile);

use Slim::Player::Client;
use Slim::Utils::Log;
use Slim::Utils::Strings qw(string);

my $URL_RE = qr/^echoclassic(\/.*)?$/;

sub initPlugin {
	my $class = shift;

	$class->SUPER::initPlugin(@_);

	my $serve = sub {
		my ($client, $params) = @_;
		return Slim::Web::HTTP::filltemplatefile('echoclassic/index.html', $params);
	};

	Slim::Web::Pages->addPageFunction($URL_RE, $serve);

	# main::WEBPAGES is a compile-time constant in some LMS builds and simply
	# absent in others -- 9.1.1 does not define it, and calling it unguarded
	# killed initPlugin before the settings page could register. Absent means
	# "no opinion", and a web skin always wants its settings page.
	if (!defined &main::WEBPAGES || main::WEBPAGES()) {
		require Plugins::EchoClassic::Settings;
		Plugins::EchoClassic::Settings->new();
	}

	return 1;
}

sub getDisplayName { return 'ECHOCLASSIC_SKIN' }

sub getSkinVersion { return '3.2.0' }

sub jsLiteral {
	my $v = defined $_[0] ? "$_[0]" : '';
	$v =~ s/([\\"])/\\$1/g;
	$v =~ s/\r/\\r/g;
	$v =~ s/\n/\\n/g;
	$v =~ s{</}{<\\/}g;
	return $v;
}

# LMS serves skin assets with Cache-Control: max-age=604800 — a week. Without a
# revision on every asset URL, a browser keeps last week's app.js and css after
# a reinstall, and the page silently runs half old code. This is the newest
# mtime under HTML/echoclassic, so it changes on every deploy without being bumped by
# hand.
# It runs inside a [% PERL %] block, and a die there makes the template render
# an EMPTY page with HTTP 200 — no error anywhere the user can see. A stale
# cache is a nuisance; a blank skin is a broken product. So every failure path
# falls back to the version string instead of throwing.
sub getAssetRevision {
	my $newest = eval {
		my $me = $INC{'Plugins/EchoClassic/Plugin.pm'};
		die "module path unknown\n" unless defined $me && length $me;

		my $found = 0;
		my @dirs = (catdir(dirname($me), 'HTML', 'echoclassic'));
		while (my $dir = shift @dirs) {
			opendir(my $dh, $dir) or next;
			for my $entry (readdir($dh)) {
				next if $entry eq '.' || $entry eq '..';
				my $path = catfile($dir, $entry);
				if (-d $path) {
					push @dirs, $path;
					next;
				}
				my $mtime = (stat($path))[9] || 0;
				$found = $mtime if $mtime > $found;
			}
			closedir($dh);
		}
		$found;
	};

	return $newest if $newest;
	return getSkinVersion();
}

sub getLmsVersion {
	my $v = $::VERSION || '0.0.0';
	$v =~ s/[^0-9.].*$//;
	return $v;
}

# O idioma da sessao do LMS, em duas letras maiusculas. E ele que decide em que
# lingua a skin fala -- forcar pt-BR num servidor em ingles era o que impedia a
# skin de ser publicavel fora do Brasil.
sub getLang {
	my $lang = eval { Slim::Utils::Strings::getLanguage() };
	$lang = 'EN' unless defined $lang && length $lang;
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
# Em portugues devolve um mapa vazio de proposito: a camada de traducao se
# desliga inteira e a skin roda como rodava antes de ela existir.
sub getStringMap {
	my $lang = getLang();
	return {} if $lang eq 'PT';

	my $map = eval {
		my $me = $INC{'Plugins/EchoClassic/Plugin.pm'};
		die "module path unknown\n" unless defined $me && length $me;

		# Lido como bytes de proposito. strings.txt e UTF-8 e o documento que
		# recebe o mapa tambem e: passar os bytes adiante sem decodificar evita
		# a dupla codificacao que transforma "reproducao" em "reproduÃ§Ã£o".
		open(my $fh, '<', catfile(dirname($me), 'strings.txt'))
			or die "strings.txt unreadable\n";

		my %out;
		my ($key, %val);
		my $flush = sub {
			return unless defined $key && $key =~ /^ECHOCLASSIC_UI_/;
			return unless defined $val{PT} && length $val{PT};
			my $target = $val{$lang};
			$target = $val{EN} unless defined $target && length $target;
			return unless defined $target && length $target;
			return if $target eq $val{PT};
			$out{ $val{PT} } = $target;
		};
		while (my $line = <$fh>) {
			$line =~ s/\r?\n$//;
			next if $line =~ /^\s*#/;
			if ($line =~ /^(\S+)\s*$/) { $flush->(); $key = $1; %val = (); next; }
			if ($line =~ /^\s+([A-Z]{2})\s+(.*)$/) { $val{$1} = $2; }
		}
		$flush->();
		close($fh);
		\%out;
	};

	# Mesma regra do getAssetRevision: um die aqui renderiza pagina vazia com
	# HTTP 200. Sem dicionario a skin fala portugues, que e degradacao aceitavel;
	# tela em branco nao e.
	return (ref $map eq 'HASH') ? $map : {};
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
		for my $c (Slim::Player::Client::clients()) {
			return $c->id if $c->connected;
		}
		'';
	};
	return defined $id ? $id : '';
}

1;
