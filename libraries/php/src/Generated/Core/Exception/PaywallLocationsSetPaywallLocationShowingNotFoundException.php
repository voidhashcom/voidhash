<?php

namespace Voidhash\Generated\Core\Exception;

class PaywallLocationsSetPaywallLocationShowingNotFoundException extends NotFoundException
{
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(?\Psr\Http\Message\ResponseInterface $response = null)
    {
        parent::__construct('Api/PaywallLocationNotFoundError | Api/PaywallNotFoundError');
        $this->response = $response;
    }
    public function getResponse(): ?\Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}