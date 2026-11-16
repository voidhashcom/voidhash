<?php

namespace Voidhash\Generated\Core\Endpoint;

class AnalyticsReportMetricActors extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    /**
     * Lists who is behind one point of a metric query's result: the people (or, for `unique_groups`, the groups) whose rows made that bucket's value, of the total or of one group of the split, read by the same query, filters and split as the point. People are listed with the events they sent in the bucket (`unique_sessions`: their sessions; `property`: the statistic of their numbers; active people: their events in the window), revenue with what each paid net of refunds, and MRR with each person's MRR at the bucket's end, money in integer minor units of `currency`. A count of people or groups has as many actors as its value, and what adds up sums to it. A cumulative query's point reads from the range's start. Pages run by `value`, most first, then by key; `total` counts the point's actors. People need the `project:persons:read` permission as well as `project:analytics:read`; groups need analytics read alone. Fails with `invalid_request` (`invalid_report_request` or `invalid_time_range`) with a message saying what to change, such as a `bucketStart` that is not one of the result's buckets.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\MetricActorsReportBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, \Voidhash\Generated\Core\Model\MetricActorsReportBodyJsonEncoding $requestBody)
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
        return str_replace(['{projectId}'], [$this->projectId], '/api/v1/projects/{projectId}/analytics/reports/metric-actors');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\MetricActorsReportBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportMetricActorsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportMetricActorsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportMetricActorsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportMetricActorsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportMetricActorsInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\MetricActorsReportResultJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\MetricActorsReportResultJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsReportMetricActorsBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsReportMetricActorsUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsReportMetricActorsForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsReportMetricActorsNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsReportMetricActorsInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}