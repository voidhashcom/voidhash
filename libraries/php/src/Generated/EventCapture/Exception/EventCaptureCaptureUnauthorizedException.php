<?php

namespace Voidhash\Generated\EventCapture\Exception;

class EventCaptureCaptureUnauthorizedException extends UnauthorizedException
{
    /**
     * @var \Voidhash\Generated\EventCapture\Model\CaptureUnauthorizedErrorJsonEncoding
     */
    private $captureUnauthorizedErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\EventCapture\Model\CaptureUnauthorizedErrorJsonEncoding $captureUnauthorizedErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('CaptureUnauthorizedError');
        $this->captureUnauthorizedErrorJsonEncoding = $captureUnauthorizedErrorJsonEncoding;
        $this->response = $response;
    }
    public function getCaptureUnauthorizedErrorJsonEncoding(): \Voidhash\Generated\EventCapture\Model\CaptureUnauthorizedErrorJsonEncoding
    {
        return $this->captureUnauthorizedErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}