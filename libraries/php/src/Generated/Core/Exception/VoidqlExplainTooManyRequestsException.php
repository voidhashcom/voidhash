<?php

namespace Voidhash\Generated\Core\Exception;

class VoidqlExplainTooManyRequestsException extends TooManyRequestsException
{
    /**
     * @var \Voidhash\Generated\Core\Model\RateLimitedErrorJsonEncoding
     */
    private $rateLimitedErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\RateLimitedErrorJsonEncoding $rateLimitedErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('`rate_limited`: too many requests; retry later.');
        $this->rateLimitedErrorJsonEncoding = $rateLimitedErrorJsonEncoding;
        $this->response = $response;
    }
    public function getRateLimitedErrorJsonEncoding(): \Voidhash\Generated\Core\Model\RateLimitedErrorJsonEncoding
    {
        return $this->rateLimitedErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}