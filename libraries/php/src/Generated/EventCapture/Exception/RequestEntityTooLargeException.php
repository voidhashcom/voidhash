<?php

namespace Voidhash\Generated\EventCapture\Exception;

class RequestEntityTooLargeException extends \RuntimeException implements ClientException
{
    public function __construct(string $message)
    {
        parent::__construct($message, 413);
    }
}