package voidhash

import (
	"context"
	"net/http"

	"github.com/voidhashcom/voidhash-go/api"
)

// OrganizationsService manages organizations. Only a person's credential,
// such as a CLI key, can create one.
type OrganizationsService struct {
	client *Client
}

// Create creates a new organization owned by the person the key acts for.
func (s *OrganizationsService) Create(ctx context.Context, params CreateOrganizationParams) (*Organization, error) {
	org := &Organization{}
	err := s.client.call(org, func() (*http.Response, error) {
		return s.client.core.OrganizationsCreate(ctx, params)
	})
	return org, err
}

// ProjectsService manages projects.
type ProjectsService struct {
	client *Client
}

// Create creates a new project inside an organization. Only a person's
// credential, such as a CLI key, can create one.
func (s *ProjectsService) Create(ctx context.Context, organizationID string, params CreateProjectParams) (*Project, error) {
	project := &Project{}
	err := s.client.call(project, func() (*http.Response, error) {
		return s.client.core.ProjectsCreate(ctx, organizationID, params)
	})
	return project, err
}

// List returns all projects of an organization.
func (s *ProjectsService) List(ctx context.Context, organizationID string) ([]Project, error) {
	return listAll[Project](s.client, func(cursor *string) (*http.Response, error) {
		return s.client.core.ProjectsList(ctx, organizationID, &api.ProjectsListParams{Cursor: cursor})
	})
}
