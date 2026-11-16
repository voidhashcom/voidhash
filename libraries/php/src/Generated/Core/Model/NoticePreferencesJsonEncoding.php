<?php

namespace Voidhash\Generated\Core\Model;

class NoticePreferencesJsonEncoding
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
     * The organization the channel preferences apply in, `org_...`.
     *
     * @var string
     */
    protected $organizationId;
    /**
     * The language notices are written in: `en` (English) or `cs` (Czech).
     *
     * @var string
     */
    protected $locale;
    /**
     * The channels of every category, one entry each.
     *
     * @var list<NoticeCategoryPreferenceJsonEncoding>
     */
    protected $categories;
    /**
     * The organization the channel preferences apply in, `org_...`.
     *
     * @return string
     */
    public function getOrganizationId(): string
    {
        return $this->organizationId;
    }
    /**
     * The organization the channel preferences apply in, `org_...`.
     *
     * @param string $organizationId
     *
     * @return self
     */
    public function setOrganizationId(string $organizationId): self
    {
        $this->initialized['organizationId'] = true;
        $this->organizationId = $organizationId;
        return $this;
    }
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
     * The channels of every category, one entry each.
     *
     * @return list<NoticeCategoryPreferenceJsonEncoding>
     */
    public function getCategories(): array
    {
        return $this->categories;
    }
    /**
     * The channels of every category, one entry each.
     *
     * @param list<NoticeCategoryPreferenceJsonEncoding> $categories
     *
     * @return self
     */
    public function setCategories(array $categories): self
    {
        $this->initialized['categories'] = true;
        $this->categories = $categories;
        return $this;
    }
}