<?php

namespace Voidhash\Generated\EventCapture\Exception;

class EventCaptureCaptureUnauthorizedException extends UnauthorizedException
{
    /**
     * @var \Voidhash\Generated\EventCapture\Model\CaptureUnauthorizedError
     */
    private $captureUnauthorizedError;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\EventCapture\Model\CaptureUnauthorizedError $captureUnauthorizedError, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('CaptureUnauthorizedError');
        $this->captureUnauthorizedError = $captureUnauthorizedError;
        $this->response = $response;
    }
    public function getCaptureUnauthorizedError(): \Voidhash\Generated\EventCapture\Model\CaptureUnauthorizedError
    {
        return $this->captureUnauthorizedError;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}