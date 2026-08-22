<?php

namespace Voidhash\Generated\EventCapture\Exception;

class EventCaptureBatchInternalServerErrorException extends InternalServerErrorException
{
    /**
     * @var \Voidhash\Generated\EventCapture\Model\CaptureInternalServerErrorJsonEncoding
     */
    private $captureInternalServerErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\EventCapture\Model\CaptureInternalServerErrorJsonEncoding $captureInternalServerErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('CaptureInternalServerError');
        $this->captureInternalServerErrorJsonEncoding = $captureInternalServerErrorJsonEncoding;
        $this->response = $response;
    }
    public function getCaptureInternalServerErrorJsonEncoding(): \Voidhash\Generated\EventCapture\Model\CaptureInternalServerErrorJsonEncoding
    {
        return $this->captureInternalServerErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}