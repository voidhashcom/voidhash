<?php

namespace Voidhash\Generated\Core\Endpoint;

class AdsReportPerformance extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    /**
     * Delivery and outcomes per campaign, ad group or ad over a range: what the platform reports (spend, impressions, clicks, results) next to the people, payers and revenue Voidhash measured from the signups credited to them. Filtered, sorted and paged, with totals over every matching row, account spend no ad accounts for, and an optional breakdown of each row by placement, country, age, gender, device or surface. Ended and removed objects appear only when they delivered in the range. Platform-reported and Voidhash-measured numbers stay in separate objects; measured numbers need `project:analytics:read` and are null without it. Money is in minor units of `currency`, rates are decimals. Safe to repeat. Fails with `invalid_request` (`invalid_report`) for a range or time zone it cannot report on. Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\AdsPerformanceReportBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, \Voidhash\Generated\Core\Model\AdsPerformanceReportBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}'], [$this->projectId], '/api/v1/projects/{projectId}/ads/reports/performance');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\AdsPerformanceReportBodyJsonEncoding) {
            return [['Content-Type' => ['application/json']], $serializer->serialize($this->body, 'json')];
        }
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\AdsReportPerformanceBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportPerformanceUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportPerformanceForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportPerformanceNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportPerformanceInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AdsReportPerformanceBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AdsReportPerformanceUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AdsReportPerformanceForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AdsReportPerformanceNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AdsReportPerformanceInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}