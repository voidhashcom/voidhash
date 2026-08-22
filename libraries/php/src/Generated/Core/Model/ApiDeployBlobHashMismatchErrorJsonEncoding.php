<?php

namespace Voidhash\Generated\Core\Model;

class ApiDeployBlobHashMismatchErrorJsonEncoding
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
     * @var string
     */
    protected $actualSha256;
    /**
     * @var string
     */
    protected $expectedSha256;
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
     * @return string
     */
    public function getActualSha256(): string
    {
        return $this->actualSha256;
    }
    /**
     * @param string $actualSha256
     *
     * @return self
     */
    public function setActualSha256(string $actualSha256): self
    {
        $this->initialized['actualSha256'] = true;
        $this->actualSha256 = $actualSha256;
        return $this;
    }
    /**
     * @return string
     */
    public function getExpectedSha256(): string
    {
        return $this->expectedSha256;
    }
    /**
     * @param string $expectedSha256
     *
     * @return self
     */
    public function setExpectedSha256(string $expectedSha256): self
    {
        $this->initialized['expectedSha256'] = true;
        $this->expectedSha256 = $expectedSha256;
        return $this;
    }
}