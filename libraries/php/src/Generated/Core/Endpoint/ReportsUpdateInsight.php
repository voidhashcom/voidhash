<?php

namespace Voidhash\Generated\Core\Endpoint;

class ReportsUpdateInsight extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $reportId;
    protected $insightId;
    /**
     * Changes an insight's title or what it asks. A query or chart replaces the one it had whole, filled in as a new one is: a field left out takes its default (the last 30 days, compared with the period before) rather than keeping its stored value, so send every field to keep; what `reports.get` answers for it holds every field and stores the same again. Its kind stays. Fails with `not_found` (`report_insight_not_found`) for an insight the report doesn't have, and `invalid_request` (`invalid_body` or `insight_kind_fixed`) for a field it doesn't know or a query of the other kind.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $reportId The report's id: its file's id in Files, `file_...`.
     * @param string $insightId The insight's id, from the report's `insights`.
     * @param \Voidhash\Generated\Core\Model\UpdateReportInsightBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $reportId, string $insightId, \Voidhash\Generated\Core\Model\UpdateReportInsightBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->reportId = $reportId;
        $this->insightId = $insightId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{reportId}', '{insightId}'], [$this->projectId, $this->reportId, $this->insightId], '/api/v1/projects/{projectId}/reports/{reportId}/insights/{insightId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdateReportInsightBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\ReportsUpdateInsightBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ReportsUpdateInsightUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ReportsUpdateInsightForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ReportsUpdateInsightNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ReportsUpdateInsightConflictException
     * @throws \Voidhash\Generated\Core\Exception\ReportsUpdateInsightInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\ReportsUpdateInsightServiceUnavailableException
     *
     * @return null|\Voidhash\Generated\Core\Model\ReportInsightJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ReportInsightJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsUpdateInsightBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsUpdateInsightUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsUpdateInsightForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsUpdateInsightNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsUpdateInsightConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsUpdateInsightInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsUpdateInsightServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}