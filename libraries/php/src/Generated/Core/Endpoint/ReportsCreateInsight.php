<?php

namespace Voidhash\Generated\Core\Endpoint;

class ReportsCreateInsight extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $reportId;
    /**
     * Adds an insight to a report, which nothing shows until the body places it with `<#insight:ID>` or `<#value:ID>` (`reports.update`). Give its query as `insight`, or a built-in chart as `chart`. An insight covers the last 30 days and compares with the period before unless it says otherwise: `range` for other days, `compare: false` for no comparison, `comparison: previous_year` or fixed days in `comparisonRange` for another one. A report has no controls, so what it shows is exactly what its insights and the body's tokens say; one number or chart is put on another period with `@RANGE` on its token, the insight unchanged. The answer holds the query as stored, with what was left out filled in. Fails with `invalid_request` (`invalid_body`, `insight_definition_missing` or `insight_definition_ambiguous`) for a field it doesn't know (named in the message), or neither or both of `insight` and `chart`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $reportId The report's id: its file's id in Files, `file_...`.
     * @param \Voidhash\Generated\Core\Model\CreateReportInsightBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $reportId, \Voidhash\Generated\Core\Model\CreateReportInsightBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->reportId = $reportId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{reportId}'], [$this->projectId, $this->reportId], '/api/v1/projects/{projectId}/reports/{reportId}/insights');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\CreateReportInsightBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\ReportsCreateInsightBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ReportsCreateInsightUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ReportsCreateInsightForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ReportsCreateInsightNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ReportsCreateInsightConflictException
     * @throws \Voidhash\Generated\Core\Exception\ReportsCreateInsightInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\ReportsCreateInsightServiceUnavailableException
     *
     * @return null|\Voidhash\Generated\Core\Model\ReportInsightJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (201 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ReportInsightJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsCreateInsightBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsCreateInsightUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsCreateInsightForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsCreateInsightNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsCreateInsightConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsCreateInsightInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsCreateInsightServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}