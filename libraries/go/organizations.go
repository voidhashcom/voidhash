package voidhash

import (
	"context"
	"net/http"

	"github.com/voidhashcom/voidhash-go/api"
)

// OrganizationsService manages organizations.
type OrganizationsService struct {
	client *Client
}

// Create creates a new organization.
func (s *OrganizationsService) Create(ctx context.Context, params CreateOrganizationParams) (*Organization, error) {
	org := &Organization{}
	err := s.client.call(org, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.OrganizationsCreateOrganization(ctx, params)
	})
	return org, err
}

// ProjectsService manages projects.
type ProjectsService struct {
	client *Client
}

// Create creates a new project inside an organization.
func (s *ProjectsService) Create(ctx context.Context, params CreateProjectParams) (*Project, error) {
	project := &Project{}
	err := s.client.call(project, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.ProjectsCreateProject(ctx, params)
	})
	return project, err
}

// List returns all projects of an organization.
func (s *ProjectsService) List(ctx context.Context, organizationID string) ([]Project, error) {
	var projects []Project
	err := s.client.call(&projects, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.ProjectsListProjects(ctx, organizationID)
	})
	return projects, err
}
