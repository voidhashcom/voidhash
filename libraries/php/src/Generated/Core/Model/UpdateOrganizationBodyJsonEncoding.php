<?php

namespace Voidhash\Generated\Core\Model;

class UpdateOrganizationBodyJsonEncoding
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
     * The new name. The slug stays as it is.
     *
     * @var string|null
     */
    protected $name;
    /**
     * The new name. The slug stays as it is.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * The new name. The slug stays as it is.
     *
     * @param string|null $name
     *
     * @return self
     */
    public function setName(?string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
}