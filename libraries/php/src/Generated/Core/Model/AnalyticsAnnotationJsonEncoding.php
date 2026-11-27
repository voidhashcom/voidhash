<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsAnnotationJsonEncoding
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
     * The project whose charts it is on.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The day it is on, `YYYY-MM-DD`. A day of the calendar, not an instant: each reader sees it on that day in their own time zone.
     *
     * @var string
     */
    protected $date;
    /**
     * The time of day it names on that day, `HH:MM` (24-hour); null for the whole day.
     *
     * @var string|null
     */
    protected $time;
    /**
     * What happened, as the chart labels it.
     *
     * @var string
     */
    protected $title;
    /**
     * More about it; null when there is nothing more.
     *
     * @var string|null
     */
    protected $description;
    /**
     * Who wrote it: `user:<id>` for a person, `bot:<key>` for a project's bot.
     *
     * @var string
     */
    protected $createdBy;
    /**
     * Their name as it reads now; null when they can no longer be named. A project's secret key or bot is told a bot's name but never a person's, which is null for it.
     *
     * @var string|null
     */
    protected $authorName;
    /**
     * When it was written, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * When it last changed, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $updatedAt;
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
     * The project whose charts it is on.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project whose charts it is on.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * The day it is on, `YYYY-MM-DD`. A day of the calendar, not an instant: each reader sees it on that day in their own time zone.
     *
     * @return string
     */
    public function getDate(): string
    {
        return $this->date;
    }
    /**
     * The day it is on, `YYYY-MM-DD`. A day of the calendar, not an instant: each reader sees it on that day in their own time zone.
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
     * The time of day it names on that day, `HH:MM` (24-hour); null for the whole day.
     *
     * @return string|null
     */
    public function getTime(): ?string
    {
        return $this->time;
    }
    /**
     * The time of day it names on that day, `HH:MM` (24-hour); null for the whole day.
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
     * What happened, as the chart labels it.
     *
     * @return string
     */
    public function getTitle(): string
    {
        return $this->title;
    }
    /**
     * What happened, as the chart labels it.
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
     * More about it; null when there is nothing more.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * More about it; null when there is nothing more.
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
     * Who wrote it: `user:<id>` for a person, `bot:<key>` for a project's bot.
     *
     * @return string
     */
    public function getCreatedBy(): string
    {
        return $this->createdBy;
    }
    /**
     * Who wrote it: `user:<id>` for a person, `bot:<key>` for a project's bot.
     *
     * @param string $createdBy
     *
     * @return self
     */
    public function setCreatedBy(string $createdBy): self
    {
        $this->initialized['createdBy'] = true;
        $this->createdBy = $createdBy;
        return $this;
    }
    /**
     * Their name as it reads now; null when they can no longer be named. A project's secret key or bot is told a bot's name but never a person's, which is null for it.
     *
     * @return string|null
     */
    public function getAuthorName(): ?string
    {
        return $this->authorName;
    }
    /**
     * Their name as it reads now; null when they can no longer be named. A project's secret key or bot is told a bot's name but never a person's, which is null for it.
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
    /**
     * When it was written, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When it was written, as an ISO 8601 timestamp.
     *
     * @param string $createdAt
     *
     * @return self
     */
    public function setCreatedAt(string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * When it last changed, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }
    /**
     * When it last changed, as an ISO 8601 timestamp.
     *
     * @param string $updatedAt
     *
     * @return self
     */
    public function setUpdatedAt(string $updatedAt): self
    {
        $this->initialized['updatedAt'] = true;
        $this->updatedAt = $updatedAt;
        return $this;
    }
}