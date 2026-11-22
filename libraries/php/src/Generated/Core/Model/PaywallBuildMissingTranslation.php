<?php

namespace Voidhash\Generated\Core\Model;

class PaywallBuildMissingTranslation
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
     * The language, as the design lists it (`de`, `pt-BR`).
     *
     * @var string
     */
    protected $locale;
    /**
     * How many texts with words to translate have no translation in it, so people reading it see the design's own language there.
     *
     * @var int
     */
    protected $missingTexts;
    /**
     * How many texts with words to translate the design has.
     *
     * @var int
     */
    protected $texts;
    /**
     * The ids of the first design nodes, at most 5, showing a text without a translation in it.
     *
     * @var list<string>
     */
    protected $exampleNodeIds;
    /**
     * The language, as the design lists it (`de`, `pt-BR`).
     *
     * @return string
     */
    public function getLocale(): string
    {
        return $this->locale;
    }
    /**
     * The language, as the design lists it (`de`, `pt-BR`).
     *
     * @param string $locale
     *
     * @return self
     */
    public function setLocale(string $locale): self
    {
        $this->initialized['locale'] = true;
        $this->locale = $locale;
        return $this;
    }
    /**
     * How many texts with words to translate have no translation in it, so people reading it see the design's own language there.
     *
     * @return int
     */
    public function getMissingTexts(): int
    {
        return $this->missingTexts;
    }
    /**
     * How many texts with words to translate have no translation in it, so people reading it see the design's own language there.
     *
     * @param int $missingTexts
     *
     * @return self
     */
    public function setMissingTexts(int $missingTexts): self
    {
        $this->initialized['missingTexts'] = true;
        $this->missingTexts = $missingTexts;
        return $this;
    }
    /**
     * How many texts with words to translate the design has.
     *
     * @return int
     */
    public function getTexts(): int
    {
        return $this->texts;
    }
    /**
     * How many texts with words to translate the design has.
     *
     * @param int $texts
     *
     * @return self
     */
    public function setTexts(int $texts): self
    {
        $this->initialized['texts'] = true;
        $this->texts = $texts;
        return $this;
    }
    /**
     * The ids of the first design nodes, at most 5, showing a text without a translation in it.
     *
     * @return list<string>
     */
    public function getExampleNodeIds(): array
    {
        return $this->exampleNodeIds;
    }
    /**
     * The ids of the first design nodes, at most 5, showing a text without a translation in it.
     *
     * @param list<string> $exampleNodeIds
     *
     * @return self
     */
    public function setExampleNodeIds(array $exampleNodeIds): self
    {
        $this->initialized['exampleNodeIds'] = true;
        $this->exampleNodeIds = $exampleNodeIds;
        return $this;
    }
}