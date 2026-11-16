<?php

/**
 * Codegen config for the Voidhash PHP SDK. Sources are the committed
 * OpenAPI documents downgraded to 3.0.x by
 * `voidhash/scripts/openapi-downgrade.mjs`, which the native generators
 * consume.
 */
return [
    'mapping' => [
        __DIR__ . '/../../packages/generated-clients/openapi/core-3.0.json' => [
            'namespace' => 'Voidhash\Generated\Core',
            'directory' => __DIR__ . '/src/Generated/Core',
        ],
        __DIR__ . '/../../packages/generated-clients/openapi/event-capture-3.0.json' => [
            'namespace' => 'Voidhash\Generated\EventCapture',
            'directory' => __DIR__ . '/src/Generated/EventCapture',
        ],
    ],
];
