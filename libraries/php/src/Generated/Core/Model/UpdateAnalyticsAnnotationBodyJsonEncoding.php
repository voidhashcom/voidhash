<?php

namespace Voidhash\Generated\Core\Model;

class UpdateAnalyticsAnnotationBodyJsonEncoding
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
     * The day it moves to, `YYYY-MM-DD`.
     *
     * @var string|null
     */
    protected $date;
    /**
     * A time of day on its day, `HH:MM`; null for the whole day.
     *
     * @var string|null
     */
    protected $time;
    /**
     * The new title, 1 to 120 characters.
     *
     * @var string|null
     */
    protected $title;
    /**
     * The new description; null takes it away.
     *
     * @var string|null
     */
    protected $description;
    /**
     * The day it moves to, `YYYY-MM-DD`.
     *
     * @return string|null
     */
    public function getDate(): ?string
    {
        return $this->date;
    }
    /**
     * The day it moves to, `YYYY-MM-DD`.
     *
     * @param string|null $date
     *
     * @return self
     */
    public function setDate(?string $date): self
    {
        $this->initialized['date'] = true;
        $this->date = $date;
        return $this;
    }
    /**
     * A time of day on its day, `HH:MM`; null for the whole day.
     *
     * @return string|null
     */
    public function getTime(): ?string
    {
        return $this->time;
    }
    /**
     * A time of day on its day, `HH:MM`; null for the whole day.
     *
     * @param string|null $time
     *
     * @return self
     */
    public function setTime(?string $time): self
    {
        $this->initialized['time'] = true;
        $this->time = $time;
        return $this;
    }
    /**
     * The new title, 1 to 120 characters.
     *
     * @return string|null
     */
    public function getTitle(): ?string
    {
        return $this->title;
    }
    /**
     * The new title, 1 to 120 characters.
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
     * The new description; null takes it away.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * The new description; null takes it away.
     *
     * @param string|null $description
     *
     * @return self
     */
    public function setDescription(?string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
}