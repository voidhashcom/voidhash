<?php

declare(strict_types=1);

namespace Voidhash\Example;

enum HttpMethod: string
{
    case Get = 'GET';
    case Post = 'POST';
}
