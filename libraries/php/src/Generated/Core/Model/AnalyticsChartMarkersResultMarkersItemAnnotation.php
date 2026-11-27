<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartMarkersResultMarkersItemAnnotation
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
     * The annotation's id, `annot_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The day it is on, `YYYY-MM-DD`, read in the request's `timezone`.
     *
     * @var string
     */
    protected $date;
    /**
     * The time of day it names, `HH:MM`; null for the day as a whole.
     *
     * @var string|null
     */
    protected $time;
    /**
     * What it says beyond its title; null when nothing.
     *
     * @var string|null
     */
    protected $description;
    /**
     * Who wrote it: `user:<id>` for a person, `bot:<key>` for a bot; null when a project's secret key wrote it.
     *
     * @var string|null
     */
    protected $createdBy;
    /**
     * Their name as it reads now, or the name of the secret key that wrote it; null when they can no longer be named, and for a person when a project's secret key or bot asks.
     *
     * @var string|null
     */
    protected $authorName;
    /**
     * The annotation's id, `annot_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The annotation's id, `annot_...`.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The day it is on, `YYYY-MM-DD`, read in the request's `timezone`.
     *
     * @return string
     */
    public function getDate(): string
    {
        return $this->date;
    }
    /**
     * The day it is on, `YYYY-MM-DD`, read in the request's `timezone`.
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
     * The time of day it names, `HH:MM`; null for the day as a whole.
     *
     * @return string|null
     */
    public function getTime(): ?string
    {
        return $this->time;
    }
    /**
     * The time of day it names, `HH:MM`; null for the day as a whole.
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
     * What it says beyond its title; null when nothing.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * What it says beyond its title; null when nothing.
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
    /**
     * Who wrote it: `user:<id>` for a person, `bot:<key>` for a bot; null when a project's secret key wrote it.
     *
     * @return string|null
     */
    public function getCreatedBy(): ?string
    {
        return $this->createdBy;
    }
    /**
     * Who wrote it: `user:<id>` for a person, `bot:<key>` for a bot; null when a project's secret key wrote it.
     *
     * @param string|null $createdBy
     *
     * @return self
     */
    public function setCreatedBy(?string $createdBy): self
    {
        $this->initialized['createdBy'] = true;
        $this->createdBy = $createdBy;
        return $this;
    }
    /**
     * Their name as it reads now, or the name of the secret key that wrote it; null when they can no longer be named, and for a person when a project's secret key or bot asks.
     *
     * @return string|null
     */
    public function getAuthorName(): ?string
    {
        return $this->authorName;
    }
    /**
     * Their name as it reads now, or the name of the secret key that wrote it; null when they can no longer be named, and for a person when a project's secret key or bot asks.
     *
     * @param string|null $authorName
     *
     * @return self
     */
    public function setAuthorName(?string $authorName): self
    {
        $this->initialized['authorName'] = true;
        $this->authorName = $authorName;
        return $this;
    }
}