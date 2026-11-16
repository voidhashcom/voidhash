<?php

namespace Voidhash\Generated\EventCapture\Exception;

class EventCaptureBatchTooManyRequestsException extends TooManyRequestsException
{
    /**
     * @var \Voidhash\Generated\EventCapture\Model\CaptureRateLimitedError
     */
    private $captureRateLimitedError;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\EventCapture\Model\CaptureRateLimitedError $captureRateLimitedError, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('CaptureRateLimitedError');
        $this->captureRateLimitedError = $captureRateLimitedError;
        $this->response = $response;
    }
    public function getCaptureRateLimitedError(): \Voidhash\Generated\EventCapture\Model\CaptureRateLimitedError
    {
        return $this->captureRateLimitedError;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}