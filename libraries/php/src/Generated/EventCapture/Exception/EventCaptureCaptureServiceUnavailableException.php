<?php

namespace Voidhash\Generated\EventCapture\Exception;

class EventCaptureCaptureServiceUnavailableException extends ServiceUnavailableException
{
    /**
     * @var \Voidhash\Generated\EventCapture\Model\CaptureDependencyUnavailableErrorJsonEncoding
     */
    private $captureDependencyUnavailableErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\EventCapture\Model\CaptureDependencyUnavailableErrorJsonEncoding $captureDependencyUnavailableErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('CaptureDependencyUnavailableError');
        $this->captureDependencyUnavailableErrorJsonEncoding = $captureDependencyUnavailableErrorJsonEncoding;
        $this->response = $response;
    }
    public function getCaptureDependencyUnavailableErrorJsonEncoding(): \Voidhash\Generated\EventCapture\Model\CaptureDependencyUnavailableErrorJsonEncoding
    {
        return $this->captureDependencyUnavailableErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}