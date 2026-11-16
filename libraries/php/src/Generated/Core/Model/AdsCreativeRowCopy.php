<?php

namespace Voidhash\Generated\Core\Model;

class AdsCreativeRowCopy
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
     * The primary texts shown above the media.
     *
     * @var list<string>
     */
    protected $primaryTexts;
    /**
     * The headlines.
     *
     * @var list<string>
     */
    protected $headlines;
    /**
     * The link descriptions.
     *
     * @var list<string>
     */
    protected $descriptions;
    /**
     * The primary texts shown above the media.
     *
     * @return list<string>
     */
    public function getPrimaryTexts(): array
    {
        return $this->primaryTexts;
    }
    /**
     * The primary texts shown above the media.
     *
     * @param list<string> $primaryTexts
     *
     * @return self
     */
    public function setPrimaryTexts(array $primaryTexts): self
    {
        $this->initialized['primaryTexts'] = true;
        $this->primaryTexts = $primaryTexts;
        return $this;
    }
    /**
     * The headlines.
     *
     * @return list<string>
     */
    public function getHeadlines(): array
    {
        return $this->headlines;
    }
    /**
     * The headlines.
     *
     * @param list<string> $headlines
     *
     * @return self
     */
    public function setHeadlines(array $headlines): self
    {
        $this->initialized['headlines'] = true;
        $this->headlines = $headlines;
        return $this;
    }
    /**
     * The link descriptions.
     *
     * @return list<string>
     */
    public function getDescriptions(): array
    {
        return $this->descriptions;
    }
    /**
     * The link descriptions.
     *
     * @param list<string> $descriptions
     *
     * @return self
     */
    public function setDescriptions(array $descriptions): self
    {
        $this->initialized['descriptions'] = true;
        $this->descriptions = $descriptions;
        return $this;
    }
}