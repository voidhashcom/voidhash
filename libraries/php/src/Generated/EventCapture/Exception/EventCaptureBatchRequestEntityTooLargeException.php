<?php

namespace Voidhash\Generated\EventCapture\Exception;

class EventCaptureBatchRequestEntityTooLargeException extends RequestEntityTooLargeException
{
    /**
     * @var \Voidhash\Generated\EventCapture\Model\CapturePayloadTooLargeError
     */
    private $capturePayloadTooLargeError;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\EventCapture\Model\CapturePayloadTooLargeError $capturePayloadTooLargeError, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('CapturePayloadTooLargeError');
        $this->capturePayloadTooLargeError = $capturePayloadTooLargeError;
        $this->response = $response;
    }
    public function getCapturePayloadTooLargeError(): \Voidhash\Generated\EventCapture\Model\CapturePayloadTooLargeError
    {
        return $this->capturePayloadTooLargeError;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}