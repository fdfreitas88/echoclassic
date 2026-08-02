package Plugins::EchoClassic::Settings;

# Server-side settings page. The skin's own Ajustes tab covers what the user
# needs day to day; this exists so the plugin appears in the LMS settings list
# and so preferences survive restarts.

use strict;

use base qw(Slim::Web::Settings);

use Slim::Utils::Prefs;

my $prefs = preferences('plugin.echoclassic');

$prefs->init({
	showSpecBadges => 1,
	markHiRes      => 1,
	darkTheme      => 0,
});

sub name { return 'PLUGIN_ECHOCLASSIC_SKIN_SETTINGS' }

sub page { return 'plugins/EchoClassic/settings/basic.html' }

sub prefs { return ($prefs, qw(showSpecBadges markHiRes darkTheme)) }

1;
