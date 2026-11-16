<?php

namespace Voidhash\Generated\Core\Model;

class UpdateNoticePreferencesBodyJsonEncoding
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
     * The language notices are written in: `en` (English) or `cs` (Czech).
     *
     * @var string
     */
    protected $locale;
    /**
     * The categories whose channels change in this organization; categories left out keep theirs.
     *
     * @var list<NoticeCategoryPreferenceChangeJsonEncoding>|null
     */
    protected $categories;
    /**
     * The language notices are written in: `en` (English) or `cs` (Czech).
     *
     * @return string
     */
    public function getLocale(): string
    {
        return $this->locale;
    }
    /**
     * The language notices are written in: `en` (English) or `cs` (Czech).
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
     * The categories whose channels change in this organization; categories left out keep theirs.
     *
     * @return list<NoticeCategoryPreferenceChangeJsonEncoding>|null
     */
    public function getCategories(): ?array
    {
        return $this->categories;
    }
    /**
     * The categories whose channels change in this organization; categories left out keep theirs.
     *
     * @param list<NoticeCategoryPreferenceChangeJsonEncoding>|null $categories
     *
     * @return self
     */
    public function setCategories(?array $categories): self
    {
        $this->initialized['categories'] = true;
        $this->categories = $categories;
        return $this;
    }
}