<?php

namespace Voidhash\Generated\Core\Endpoint;

class ReportsUpdate extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $reportId;
    /**
     * Writes a report's body, whole with `content` or in parts with `contentEdits`. A report is live and has no controls; a number or chart in it can show a period of its own with `@RANGE` at the end of its token. Everything the request carries is checked before anything is written. Blocks the write leaves as they were keep their place, so people typing elsewhere in the report aren't disturbed. Fails with `invalid_request` (`invalid_body`, `unknown_report_insight`, `unknown_value_show`, `invalid_report_period`, `report_too_long`, `report_block_too_large`, `report_text_not_found`, `report_text_not_unique` or `report_content_ambiguous`) for a field it doesn't know, a body naming an insight the report doesn't have (add it with `reports.createInsight` first), an inline value saying what none says, a token over a period that isn't one (a period is a named range such as `last_30d`, days such as `2025-01-01..2025-12-31`, or `2025`, `2025-10`, `2025-11-12`), a body too long, an edit's `oldText` that isn't there exactly once, or neither or both of `content` and `contentEdits`, with `param` naming the field or edit. A long body is written in several steps: `unavailable` (`report_partly_written`) or `conflict` (`report_write_incomplete` or `report_changed_while_writing`) mean only part of it was, and sending the same `content` again finishes it.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $reportId The report's id: its file's id in Files, `file_...`.
     * @param \Voidhash\Generated\Core\Model\UpdateReportBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $reportId, \Voidhash\Generated\Core\Model\UpdateReportBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->reportId = $reportId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{reportId}'], [$this->projectId, $this->reportId], '/api/v1/projects/{projectId}/reports/{reportId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdateReportBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\ReportsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ReportsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ReportsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ReportsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ReportsUpdateConflictException
     * @throws \Voidhash\Generated\Core\Exception\ReportsUpdateInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\ReportsUpdateServiceUnavailableException
     *
     * @return null|\Voidhash\Generated\Core\Model\ReportJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ReportJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsUpdateBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsUpdateUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsUpdateForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsUpdateNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsUpdateConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsUpdateInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ReportsUpdateServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}