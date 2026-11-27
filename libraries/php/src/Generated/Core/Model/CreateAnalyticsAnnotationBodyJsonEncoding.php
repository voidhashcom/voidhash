<?php

namespace Voidhash\Generated\Core\Model;

class CreateAnalyticsAnnotationBodyJsonEncoding
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
     * The day it is on, `YYYY-MM-DD`.
     *
     * @var string
     */
    protected $date;
    /**
     * A time of day on that day, `HH:MM` (24-hour); the whole day when omitted.
     *
     * @var string|null
     */
    protected $time;
    /**
     * What happened, 1 to 120 characters.
     *
     * @var string
     */
    protected $title;
    /**
     * More about it, up to 2000 characters.
     *
     * @var string|null
     */
    protected $description;
    /**
     * The day it is on, `YYYY-MM-DD`.
     *
     * @return string
     */
    public function getDate(): string
    {
        return $this->date;
    }
    /**
     * The day it is on, `YYYY-MM-DD`.
     *
     * @param string $date
     *
     * @return self
     */
    public function setDate(string $date): self
    {
        $this->initialized['date'] = true;
        $this->date = $date;
        return $this;
    }
    /**
     * A time of day on that day, `HH:MM` (24-hour); the whole day when omitted.
     *
     * @return string|null
     */
    public function getTime(): ?string
    {
        return $this->time;
    }
    /**
     * A time of day on that day, `HH:MM` (24-hour); the whole day when omitted.
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
     * What happened, 1 to 120 characters.
     *
     * @return string
     */
    public function getTitle(): string
    {
        return $this->title;
    }
    /**
     * What happened, 1 to 120 characters.
     *
     * @param string $title
     *
     * @return self
     */
    public function setTitle(string $title): self
    {
        $this->initialized['title'] = true;
        $this->title = $title;
        return $this;
    }
    /**
     * More about it, up to 2000 characters.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * More about it, up to 2000 characters.
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