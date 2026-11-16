<?php

namespace Voidhash\Generated\Core\Model;

class UpdatePaywallComponentBodyJsonEncoding
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
     * The new title, 1 to 255 characters.
     *
     * @var string|null
     */
    protected $title;
    /**
     * The editor group to list the component in, at most 64 characters; null moves it back to the project's default group.
     *
     * @var string|null
     */
    protected $category;
    /**
     * The new title, 1 to 255 characters.
     *
     * @return string|null
     */
    public function getTitle(): ?string
    {
        return $this->title;
    }
    /**
     * The new title, 1 to 255 characters.
     *
     * @param string|null $title
     *
     * @return self
     */
    public function setTitle(?string $title): self
    {
        $this->initialized['title'] = true;
        $this->title = $title;
        return $this;
    }
    /**
     * The editor group to list the component in, at most 64 characters; null moves it back to the project's default group.
     *
     * @return string|null
     */
    public function getCategory(): ?string
    {
        return $this->category;
    }
    /**
     * The editor group to list the component in, at most 64 characters; null moves it back to the project's default group.
     *
     * @param string|null $category
     *
     * @return self
     */
    public function setCategory(?string $category): self
    {
        $this->initialized['category'] = true;
        $this->category = $category;
        return $this;
    }
}