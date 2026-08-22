<?php

declare(strict_types=1);

namespace Voidhash\Example\Exception;

/** The process cannot start: a required environment variable is missing or malformed. */
final class ConfigurationException extends \RuntimeException
{
}
