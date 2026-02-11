<?php

use craft\helpers\App;

return [
    'enabled' => App::env('CRAFT_DEV_MODE') ?? false,
];
