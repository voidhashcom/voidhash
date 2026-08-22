<?php

namespace Voidhash\Generated\EventCapture\Exception;

class EventCaptureBatchTooManyRequestsException extends TooManyRequestsException
{
    /**
     * @var \Voidhash\Generated\EventCapture\Model\CaptureRateLimitedErrorJsonEncoding
     */
    private $captureRateLimitedErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\EventCapture\Model\CaptureRateLimitedErrorJsonEncoding $captureRateLimitedErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('CaptureRateLimitedError');
        $this->captureRateLimitedErrorJsonEncoding = $captureRateLimitedErrorJsonEncoding;
        $this->response = $response;
    }
    public function getCaptureRateLimitedErrorJsonEncoding(): \Voidhash\Generated\EventCapture\Model\CaptureRateLimitedErrorJsonEncoding
    {
        return $this->captureRateLimitedErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}