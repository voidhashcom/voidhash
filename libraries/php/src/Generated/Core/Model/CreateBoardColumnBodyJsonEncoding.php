<?php

namespace Voidhash\Generated\Core\Model;

class CreateBoardColumnBodyJsonEncoding
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
    protected $kind;
    /**
     * @var string|null
     */
    protected $afterColumnId;
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
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getAfterColumnId(): ?string
    {
        return $this->afterColumnId;
    }
    /**
     * @param string|null $afterColumnId
     *
     * @return self
     */
    public function setAfterColumnId(?string $afterColumnId): self
    {
        $this->initialized['afterColumnId'] = true;
        $this->afterColumnId = $afterColumnId;
        return $this;
    }
}