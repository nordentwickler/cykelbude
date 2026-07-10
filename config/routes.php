<?php

return [
    'blog' => ['template' => '_pages/blog/index.twig'],

    // Dynamisch generiertes Share-/OG-Bild pro Eintrag.
    // Endungslos, sonst fängt nginx die .png-URL als statische Datei ab.
    'og/<id:\d+>' => 'site-module/og/image',
];
