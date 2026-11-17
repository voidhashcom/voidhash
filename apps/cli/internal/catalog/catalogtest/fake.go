// Package catalogtest is a fake API with a project's catalog, payment
// providers and sandbox, for the tests of the commands that use them.
package catalogtest

import (
	"fmt"

	"github.com/voidhashcom/voidhash/apps/cli/internal/clitest"
)

// M is a JSON object.
type M = clitest.M

const base = "/api/v1/projects/{projectId}"

// Fake is the state behind the fake API's routes; a test changes it before
// a run and reads it after.
type Fake struct {
	*clitest.FakeAPI
	Products []M
	Perks    []M
	// Grants are the ids of the perks each product grants, by product id.
	Grants    map[string][]string
	Providers []M
	Mappings  []M
	// Catalog are the store products each provider sells, by provider id.
	Catalog map[string][]M
	// Unreadable are the providers whose store does not answer.
	Unreadable map[string]bool
	// Waiting are the store products purchases wait for, by provider id.
	Waiting map[string][]M
	// Imports are the history imports, by provider id.
	Imports map[string][]M
	// Tests are what a payment source's endpoints answer, by environment.
	Tests   map[string]clitest.Answer
	Persons []M
	// Sandbox is each person's sandbox state, by person id.
	Sandbox map[string]M
	Actions []M
	nextID  int
}

func product(id, slug, name string, period any) M {
	kind := "subscription"
	if period == nil {
		kind = "one_time"
	}
	return M{"id": id, "projectId": "proj_app", "name": name, "slug": slug, "type": kind, "billingPeriod": period}
}

func perk(id, slug, name string) M {
	return M{"id": id, "projectId": "proj_app", "name": name, "slug": slug}
}

// Provider is a payment provider of the fake project.
func Provider(id, kind, name string, key any, configuration M) M {
	return M{
		"id": id, "projectId": "proj_app", "type": kind, "name": name, "key": key, "isEnabled": true,
		"configuration": configuration, "createdAt": nil, "updatedAt": nil,
	}
}

// Mapping is a store product's mapping to a product.
func Mapping(id, providerID, productID, key string, isActive bool) M {
	return M{
		"id": id, "paymentProviderId": providerID, "productId": productID, "providerProductKey": key,
		"isActive": isActive, "environment": "all", "configuration": M{"productId": key},
	}
}

func page(r *clitest.Request, items []M) clitest.Answer {
	list := make([]any, len(items))
	for index, item := range items {
		list[index] = item
	}
	return clitest.Paginate(r, list)
}

func find(items []M, id string) (M, int) {
	for index, item := range items {
		if item["id"] == id {
			return item, index
		}
	}
	return nil, -1
}

func (f *Fake) id(prefix string) string {
	f.nextID++
	return fmt.Sprintf("%s_new%d", prefix, f.nextID)
}

// New is a fake API whose only project, App (acme/app), sells three
// products through the App Store and has one tester, Kim.
func New() *Fake {
	f := &Fake{
		FakeAPI: clitest.NewFakeAPI(),
		Products: []M{
			product("prod_monthly", "pro-monthly", "Pro Monthly", "monthly"),
			product("prod_annual", "pro-annual", "Pro Annual", "annual"),
			product("prod_life", "lifetime", "Lifetime", nil),
		},
		Perks: []M{
			perk("perk_premium", "premium", "Premium"),
			perk("perk_adfree", "ad-free", "Ad-free"),
			perk("perk_legacy", "legacy", "Legacy"),
		},
		Grants:    map[string][]string{"prod_monthly": {"perk_premium", "perk_legacy"}, "prod_annual": {"perk_premium"}},
		Providers: []M{Provider("pp_ios", "app_store", "App Store", "com.acme.app", M{"bundleId": "com.acme.app"})},
		Mappings:  []M{Mapping("pp_prod_1", "pp_ios", "prod_monthly", "com.acme.pro.monthly", true)},
		Catalog: map[string][]M{"pp_ios": {
			{"providerProductKey": "com.acme.pro.monthly", "name": "Pro Monthly", "configuration": M{"productId": "com.acme.pro.monthly"}},
			{"providerProductKey": "com.acme.pro.annual", "name": "Pro Annual", "configuration": M{"productId": "com.acme.pro.annual"}},
		}},
		Unreadable: map[string]bool{},
		Waiting:    map[string][]M{},
		Imports:    map[string][]M{},
		Tests:      map[string]clitest.Answer{},
		Persons: []M{{
			"id": "person_kim", "projectId": "proj_app", "distinctId": "user-42", "email": "kim@example.com",
			"name": "Kim", "isIdentified": true, "createdAt": nil,
		}},
		Sandbox: map[string]M{"person_kim": {
			"personId":  "person_kim",
			"grants":    []any{M{"id": "person_perk_1", "perkId": "perk_premium", "status": "active", "expiresAt": "2026-11-01T00:00:00Z"}},
			"purchases": []any{},
			"subscriptions": []any{M{
				"id": "sub_1", "productId": "prod_monthly", "status": "active", "startsAt": "2026-10-01T00:00:00Z",
				"expiresAt": "2026-11-01T00:00:00Z", "gracePeriodExpiresAt": nil, "canceledAt": nil,
			}},
		}},
	}
	f.Session = clitest.OneProjectSession()
	f.catalogRoutes()
	f.providerRoutes()
	f.sandboxRoutes()
	return f
}

func (f *Fake) catalogRoutes() {
	f.Handle("GET "+base+"/products", func(r *clitest.Request) clitest.Answer {
		var kept []M
		for _, item := range f.Products {
			if kind := r.Query.Get("type"); kind == "" || item["type"] == kind {
				kept = append(kept, item)
			}
		}
		return page(r, kept)
	})
	f.Handle("POST "+base+"/products", func(r *clitest.Request) clitest.Answer {
		for _, item := range f.Products {
			if item["slug"] == r.Text("slug") {
				return clitest.Failure(409, "conflict", "product_slug_taken",
					"This project already has a product with the slug "+r.Text("slug")+".")
			}
		}
		created := M{
			"id": f.id("prod"), "projectId": "proj_app", "name": r.Text("name"), "slug": r.Text("slug"),
			"type": r.Text("type"), "billingPeriod": r.Body["billingPeriod"],
		}
		f.Products = append(f.Products, created)
		return clitest.JSON(201, created)
	})
	f.Handle("PATCH "+base+"/products/{id}", func(r *clitest.Request) clitest.Answer {
		return rename(f.Products, r, "product_not_found")
	})
	f.Handle("DELETE "+base+"/products/{id}", func(r *clitest.Request) clitest.Answer {
		_, index := find(f.Products, r.Param("id"))
		if index < 0 {
			return clitest.NotFound("product_not_found", "This project has no such product.")
		}
		for _, mapping := range f.Mappings {
			if mapping["productId"] == r.Param("id") {
				return clitest.Failure(409, "conflict", "product_in_use", "Store products are mapped to this product.")
			}
		}
		f.Products = append(f.Products[:index:index], f.Products[index+1:]...)
		return clitest.NoContent()
	})
	f.Handle("GET "+base+"/products/{id}/perks", func(r *clitest.Request) clitest.Answer {
		var granted []M
		for _, perkID := range f.Grants[r.Param("id")] {
			if found, _ := find(f.Perks, perkID); found != nil {
				granted = append(granted, found)
			}
		}
		return page(r, granted)
	})
	f.Handle("PUT "+base+"/products/{id}/perks/{perkId}", func(r *clitest.Request) clitest.Answer {
		f.Grants[r.Param("id")] = append(f.Grants[r.Param("id")], r.Param("perkId"))
		return clitest.NoContent()
	})
	f.Handle("DELETE "+base+"/products/{id}/perks/{perkId}", func(r *clitest.Request) clitest.Answer {
		var kept []string
		for _, perkID := range f.Grants[r.Param("id")] {
			if perkID != r.Param("perkId") {
				kept = append(kept, perkID)
			}
		}
		f.Grants[r.Param("id")] = kept
		return clitest.NoContent()
	})
	f.Handle("GET "+base+"/perks", func(r *clitest.Request) clitest.Answer { return page(r, f.Perks) })
	f.Handle("POST "+base+"/perks", func(r *clitest.Request) clitest.Answer {
		for _, item := range f.Perks {
			if item["slug"] == r.Text("slug") {
				return clitest.Failure(409, "conflict", "perk_slug_taken", "This project already has a perk with the slug "+r.Text("slug")+".")
			}
		}
		created := perk(f.id("perk"), r.Text("slug"), r.Text("name"))
		f.Perks = append(f.Perks, created)
		return clitest.JSON(201, created)
	})
	f.Handle("PATCH "+base+"/perks/{id}", func(r *clitest.Request) clitest.Answer {
		return rename(f.Perks, r, "perk_not_found")
	})
	f.Handle("DELETE "+base+"/perks/{id}", func(r *clitest.Request) clitest.Answer {
		_, index := find(f.Perks, r.Param("id"))
		if index < 0 {
			return clitest.NotFound("perk_not_found", "This project has no such perk.")
		}
		f.Perks = append(f.Perks[:index:index], f.Perks[index+1:]...)
		return clitest.NoContent()
	})
}

// rename applies the name and slug of a PATCH to the item it names.
func rename(items []M, r *clitest.Request, missing string) clitest.Answer {
	found, _ := find(items, r.Param("id"))
	if found == nil {
		return clitest.NotFound(missing, "This project has no such item.")
	}
	for _, key := range []string{"name", "slug"} {
		if value, ok := r.Body[key].(string); ok {
			found[key] = value
		}
	}
	return clitest.OK(found)
}

func (f *Fake) providerRoutes() {
	providers := base + "/payment-providers"
	f.Handle("GET "+providers, func(r *clitest.Request) clitest.Answer {
		var kept []M
		for _, item := range f.Providers {
			if kind := r.Query.Get("type"); kind == "" || item["type"] == kind {
				kept = append(kept, item)
			}
		}
		return page(r, kept)
	})
	f.Handle("POST "+providers, func(r *clitest.Request) clitest.Answer {
		created := Provider(f.id("pp"), r.Text("type"), r.Text("name"), nil, M{})
		created["isEnabled"] = false
		if configuration, ok := r.Body["configuration"].(M); ok {
			created["configuration"] = configuration
			if slug, ok := configuration["slug"].(string); ok {
				created["key"], created["isEnabled"] = slug, true
			}
		}
		f.Providers = append(f.Providers, created)
		return clitest.JSON(201, created)
	})
	f.Handle("PATCH "+providers+"/{id}", func(r *clitest.Request) clitest.Answer {
		found, _ := find(f.Providers, r.Param("id"))
		if found == nil {
			return clitest.NotFound("payment_provider_not_found", "This project has no such payment provider.")
		}
		if name, ok := r.Body["name"].(string); ok {
			found["name"] = name
		}
		if isEnabled, ok := r.Body["isEnabled"].(bool); ok {
			found["isEnabled"] = isEnabled
		}
		if configuration, ok := r.Body["configuration"].(M); ok {
			found["configuration"] = configuration
			for _, key := range []string{"bundleId", "packageName", "accountId"} {
				if value, ok := configuration[key].(string); ok {
					found["key"] = value
				}
			}
		}
		return clitest.OK(found)
	})
	f.Handle("DELETE "+providers+"/{id}", func(r *clitest.Request) clitest.Answer {
		_, index := find(f.Providers, r.Param("id"))
		for _, mapping := range f.Mappings {
			if mapping["paymentProviderId"] == r.Param("id") {
				return clitest.Failure(409, "conflict", "payment_provider_in_use", "Store products of this provider are mapped to products.")
			}
		}
		f.Providers = append(f.Providers[:index:index], f.Providers[index+1:]...)
		return clitest.NoContent()
	})
	f.Handle("GET "+providers+"/{id}/catalog", func(r *clitest.Request) clitest.Answer {
		if f.Unreadable[r.Param("id")] {
			return clitest.Failure(502, "unavailable", "payment_provider_unavailable", "The store did not answer.")
		}
		var entries []M
		for _, entry := range f.Catalog[r.Param("id")] {
			mappings := []any{}
			for _, mapping := range f.Mappings {
				if mapping["paymentProviderId"] == r.Param("id") && mapping["providerProductKey"] == entry["providerProductKey"] {
					mappings = append(mappings, mapping)
				}
			}
			if wanted := r.Query.Get("isUnmapped"); wanted != "" && (wanted == "true") != (len(mappings) == 0) {
				continue
			}
			entries = append(entries, M{
				"providerProductKey": entry["providerProductKey"], "name": entry["name"],
				"configuration": entry["configuration"], "mappings": mappings,
			})
		}
		return page(r, entries)
	})
	f.Handle("GET "+providers+"/{id}/unmapped-products", func(r *clitest.Request) clitest.Answer {
		return page(r, f.Waiting[r.Param("id")])
	})
	f.Handle("GET "+providers+"/{id}/products", func(r *clitest.Request) clitest.Answer {
		var kept []M
		for _, mapping := range f.Mappings {
			if mapping["paymentProviderId"] != r.Param("id") {
				continue
			}
			if productID := r.Query.Get("productId"); productID != "" && mapping["productId"] != productID {
				continue
			}
			if key := r.Query.Get("providerProductKey"); key != "" && mapping["providerProductKey"] != key {
				continue
			}
			kept = append(kept, mapping)
		}
		return page(r, kept)
	})
	f.Handle("POST "+providers+"/{id}/products", func(r *clitest.Request) clitest.Answer {
		configuration, _ := r.Body["configuration"].(M)
		key := ""
		for _, name := range []string{"productKey", "productId"} {
			if value, ok := configuration[name].(string); ok && key == "" {
				key = value
			}
		}
		if price, ok := configuration["priceId"].(string); ok {
			if price == "" {
				return clitest.Failure(400, "invalid_request", "invalid_product_mapping", "A Stripe mapping needs a price.")
			}
			key += ":" + price
		}
		for _, mapping := range f.Mappings {
			if mapping["paymentProviderId"] == r.Param("id") && mapping["providerProductKey"] == key && mapping["isActive"] == true {
				if r.Body["isReassignment"] != true {
					return clitest.Failure(409, "conflict", "product_mapping_exists", "This store product is mapped already.")
				}
				mapping["isActive"] = false
			}
		}
		created := Mapping(f.id("pp_prod"), r.Param("id"), r.Text("productId"), key, true)
		created["configuration"] = configuration
		if environment := r.Text("environment"); environment != "" {
			created["environment"] = environment
		}
		f.Mappings = append(f.Mappings, created)
		return clitest.JSON(201, created)
	})
	f.Handle("PATCH "+providers+"/{id}/products/{mappingId}", func(r *clitest.Request) clitest.Answer {
		found, _ := find(f.Mappings, r.Param("mappingId"))
		if configuration, ok := r.Body["configuration"].(M); ok {
			found["configuration"] = configuration
		}
		if environment := r.Text("environment"); environment != "" {
			found["environment"] = environment
		}
		return clitest.OK(found)
	})
	f.Handle("POST "+providers+"/{id}/products/{mappingId}/activate", func(r *clitest.Request) clitest.Answer {
		found, _ := find(f.Mappings, r.Param("mappingId"))
		found["isActive"] = true
		return clitest.OK(found)
	})
	f.Handle("DELETE "+providers+"/{id}/products/{mappingId}", func(r *clitest.Request) clitest.Answer {
		found, index := find(f.Mappings, r.Param("mappingId"))
		if found["hasPurchases"] == true {
			return clitest.Failure(409, "conflict", "product_mapping_has_purchases", "Purchases were recorded under this mapping.")
		}
		f.Mappings = append(f.Mappings[:index:index], f.Mappings[index+1:]...)
		return clitest.NoContent()
	})
	f.Handle("GET "+providers+"/{id}/imports", func(r *clitest.Request) clitest.Answer {
		var kept []M
		for _, item := range f.Imports[r.Param("id")] {
			if environment := r.Query.Get("environment"); environment == "" || item["environment"] == environment {
				kept = append(kept, item)
			}
		}
		return page(r, kept)
	})
	f.Handle("POST "+providers+"/{id}/imports", func(r *clitest.Request) clitest.Answer {
		found, _ := find(f.Providers, r.Param("id"))
		if configuration, _ := found["configuration"].(M); found["type"] == "payment_source" && configuration["endpoint"] == nil {
			return clitest.Failure(409, "conflict", "history_import_blocked", "This payment source has no endpoint to import from.")
		}
		created := Import(f.id("pp_import"), r.Param("id"), r.Text("environment"), "running", "collecting", 0, 0)
		f.Imports[r.Param("id")] = append(f.Imports[r.Param("id")], created)
		return clitest.JSON(201, created)
	})
	f.Handle("GET "+providers+"/{id}/imports/{importId}", func(r *clitest.Request) clitest.Answer {
		found, _ := find(f.Imports[r.Param("id")], r.Param("importId"))
		// An import a test watches ends on its second reading.
		if found["phase"] == "applying" {
			found["status"], found["phase"] = "completed", "done"
			found["counts"] = M{"total": 3, "applied": 2, "ignored": 0, "parked": 1, "failed": 0, "pending": 0}
		} else {
			found["phase"] = "applying"
			found["counts"] = M{"total": 3, "applied": 0, "ignored": 0, "parked": 0, "failed": 0, "pending": 3}
		}
		return clitest.OK(found)
	})
	f.Handle("POST "+providers+"/{id}/imports/{importId}/cancel", func(r *clitest.Request) clitest.Answer {
		found, _ := find(f.Imports[r.Param("id")], r.Param("importId"))
		found["status"], found["phase"] = "canceled", "done"
		return clitest.OK(found)
	})
	f.Handle("POST "+providers+"/{id}/test", func(r *clitest.Request) clitest.Answer {
		environment := r.Query.Get("environment")
		if environment == "" {
			environment = "production"
		}
		if answer, ok := f.Tests[environment]; ok {
			return answer
		}
		return clitest.OK(M{"operations": []any{"catalog.list", "history.list"}, "sdk": M{"name": "voidhash-node", "version": "1.2.0"}})
	})
	f.Handle("PUT "+providers+"/{id}/transactions/{externalId}", func(r *clitest.Request) clitest.Answer {
		return clitest.OK(M{
			"id": r.Param("externalId"), "paymentProviderId": r.Param("id"), "type": r.Text("type"),
			"status": "applied", "pendingReason": nil, "purchaseId": "pur_1", "bookedAmount": r.Body["amount"],
		})
	})
	f.Handle("POST "+providers+"/{id}/transactions/{externalId}/refund", func(r *clitest.Request) clitest.Answer {
		if r.Param("externalId") == "missing" {
			return clitest.NotFound("transaction_not_found", "This payment source has no such transaction.")
		}
		return clitest.OK(M{
			"id": "refund_1", "paymentProviderId": r.Param("id"), "type": "refund",
			"status": "applied", "pendingReason": nil, "purchaseId": "pur_1", "bookedAmount": 1000,
		})
	})
	f.Handle("POST "+providers+"/{id}/subscriptions/{externalId}/cancel", func(r *clitest.Request) clitest.Answer {
		found, _ := find(f.Providers, r.Param("id"))
		if configuration, _ := found["configuration"].(M); configuration["endpoint"] == nil {
			return clitest.Failure(409, "conflict", "payment_source_endpoint_not_configured", "This payment source has no endpoint.")
		}
		return clitest.OK(M{"id": r.Param("externalId"), "paymentProviderId": r.Param("id"), "status": "applied"})
	})
}

// Import is a history import of a provider.
func Import(id, providerID, environment, status, phase string, total, applied int) M {
	return M{
		"id": id, "paymentProviderId": providerID, "environment": environment, "status": status, "phase": phase,
		"counts":    M{"total": total, "applied": applied, "ignored": 0, "parked": 0, "failed": 0, "pending": total - applied},
		"lastError": nil, "completedAt": nil, "cutoffAt": "2026-10-28T12:00:00Z", "requestedAt": "2026-10-28T12:00:00Z",
	}
}

func (f *Fake) sandboxRoutes() {
	f.Handle("GET "+base+"/persons", func(r *clitest.Request) clitest.Answer {
		var kept []M
		for _, person := range f.Persons {
			distinctID, email := r.Query.Get("distinctId"), r.Query.Get("email")
			if (distinctID != "" && person["distinctId"] == distinctID) || (email != "" && person["email"] == email) {
				kept = append(kept, person)
			}
		}
		return page(r, kept)
	})
	f.Handle("GET "+base+"/persons/{id}", func(r *clitest.Request) clitest.Answer {
		if found, _ := find(f.Persons, r.Param("id")); found != nil {
			return clitest.OK(found)
		}
		return clitest.NotFound("person_not_found", "This project has no such person.")
	})
	f.Handle("GET "+base+"/sandbox/state", func(r *clitest.Request) clitest.Answer {
		personID := r.Query.Get("personId")
		if state, ok := f.Sandbox[personID]; ok {
			return clitest.OK(state)
		}
		return clitest.OK(M{"personId": personID, "grants": []any{}, "purchases": []any{}, "subscriptions": []any{}})
	})
	f.Handle("POST "+base+"/sandbox/actions", func(r *clitest.Request) clitest.Answer {
		f.Actions = append(f.Actions, r.Body)
		// Every action ends Kim's access, which is all the tests look at.
		if state, ok := f.Sandbox["person_kim"]; ok {
			for _, grant := range state["grants"].([]any) {
				grant.(M)["status"] = "expired"
			}
			for _, subscription := range state["subscriptions"].([]any) {
				subscription.(M)["status"] = "canceled"
			}
		}
		return clitest.JSON(201, r.Body)
	})
	f.Handle("DELETE "+base+"/sandbox/data", func(*clitest.Request) clitest.Answer {
		f.Sandbox = map[string]M{}
		return clitest.NoContent()
	})
}
