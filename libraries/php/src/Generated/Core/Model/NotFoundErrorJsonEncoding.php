<?php

namespace Voidhash\Generated\Core\Model;

class NotFoundErrorJsonEncoding
{
    /**
     * @var array
     */
    protected $initialized = [];
    public function isInitialized($property): bool
    {
        return array_key_exists($property, $this->initialized);
    }
    /**
     * The error: `type` is `not_found`, and `code` says why. Codes name what is missing, such as `project_not_found`, `organization_not_found` or `product_not_found`.
     *
     * @var NotFoundErrorJsonEncodingError
     */
    protected $error;
    /**
     * The error: `type` is `not_found`, and `code` says why. Codes name what is missing, such as `project_not_found`, `organization_not_found` or `product_not_found`.
     *
     * @return NotFoundErrorJsonEncodingError
     */
    public function getError(): NotFoundErrorJsonEncodingError
    {
        return $this->error;
    }
    /**
     * The error: `type` is `not_found`, and `code` says why. Codes name what is missing, such as `project_not_found`, `organization_not_found` or `product_not_found`.
     *
     * @param NotFoundErrorJsonEncodingError $error
     *
     * @return self
     */
    public function setError(NotFoundErrorJsonEncodingError $error): self
    {
        $this->initialized['error'] = true;
        $this->error = $error;
        return $this;
    }
}