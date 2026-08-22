<?php

declare(strict_types=1);

namespace Voidhash\Example\Controller;

use Voidhash\Example\Request;
use Voidhash\Example\Response;

final class HealthController
{
    /**
     * `GET /health` — liveness only.
     *
     * It never calls Voidhash. A health check that depends on a third party
     * takes your service down with them, and your load balancer will happily
     * finish the job by pulling every instance out of rotation.
     */
    public function __invoke(Request $request): Response
    {
        return Response::json(200, ['status' => 'ok', 'service' => 'nimbus-backend-php']);
    }
}
