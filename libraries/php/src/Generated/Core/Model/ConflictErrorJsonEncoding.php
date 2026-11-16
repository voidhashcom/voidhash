<?php

namespace Voidhash\Generated\Core\Model;

class ConflictErrorJsonEncoding
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
     * The error: `type` is `conflict`, and `code` says why. Codes name the state, such as `product_slug_taken` or `experiment_already_running`.
     *
     * @var ConflictErrorJsonEncodingError
     */
    protected $error;
    /**
     * The error: `type` is `conflict`, and `code` says why. Codes name the state, such as `product_slug_taken` or `experiment_already_running`.
     *
     * @return ConflictErrorJsonEncodingError
     */
    public function getError(): ConflictErrorJsonEncodingError
    {
        return $this->error;
    }
    /**
     * The error: `type` is `conflict`, and `code` says why. Codes name the state, such as `product_slug_taken` or `experiment_already_running`.
     *
     * @param ConflictErrorJsonEncodingError $error
     *
     * @return self
     */
    public function setError(ConflictErrorJsonEncodingError $error): self
    {
        $this->initialized['error'] = true;
        $this->error = $error;
        return $this;
    }
}