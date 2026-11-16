<?php

namespace Voidhash\Generated\Core\Model;

class CreateBoardLabelBodyJsonEncoding
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
     * @var string
     */
    protected $name;
    /**
     * @var string
     */
    protected $color;
    /**
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * @return string
     */
    public function getColor(): string
    {
        return $this->color;
    }
    /**
     * @param string $color
     *
     * @return self
     */
    public function setColor(string $color): self
    {
        $this->initialized['color'] = true;
        $this->color = $color;
        return $this;
    }
}