<?php

declare(strict_types=1);

namespace Voidhash\Provider;

/** The codes a provider may fail a request with on purpose. */
enum ProviderErrorCode: string
{
    /** The input makes no sense to the provider (400). */
    case InvalidRequest = 'invalid_request';
    /** The provider found nothing for the input (404). */
    case NotFound = 'not_found';
    /** The provider's upstream is down; Voidhash retries later (503). */
    case Unavailable = 'unavailable';
}
