<?php

namespace Voidhash\Generated\Core\Model;

class ApiIncompleteDeployErrorJsonEncoding
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
    protected $tag;
    /**
     * @var list<string>
     */
    protected $missing;
    /**
     * @return string
     */
    public function getTag(): string
    {
        return $this->tag;
    }
    /**
     * @param string $tag
     *
     * @return self
     */
    public function setTag(string $tag): self
    {
        $this->initialized['tag'] = true;
        $this->tag = $tag;
        return $this;
    }
    /**
     * @return list<string>
     */
    public function getMissing(): array
    {
        return $this->missing;
    }
    /**
     * @param list<string> $missing
     *
     * @return self
     */
    public function setMissing(array $missing): self
    {
        $this->initialized['missing'] = true;
        $this->missing = $missing;
        return $this;
    }
}