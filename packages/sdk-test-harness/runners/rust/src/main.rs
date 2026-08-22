//! Generic conformance runner for the Voidhash SDK test harness. Like the
//! iOS and Android runners it is fully generic: step descriptors come from
//! the /__harness control plane and no fixture data is encoded locally, so
//! suites can evolve without touching this file.

use serde_json::Value;

fn main() {
    let base_url = std::env::var("HARNESS_URL").unwrap_or_else(|_| "http://127.0.0.1:4919".into());
    if let Err(error) = run(&base_url) {
        eprintln!("conformance: {error}");
        std::process::exit(1);
    }
}

fn run(base_url: &str) -> Result<(), String> {
    let client = reqwest::blocking::Client::new();

    let suites = get_json(&client, &format!("{base_url}/__harness/suites"))?;
    let suite_names: Vec<String> = suites["suites"]
        .as_array()
        .ok_or("malformed suite list")?
        .iter()
        .filter_map(|suite| suite["name"].as_str().map(str::to_string))
        // The harness self-test suites exercise the verifier itself, not the
        // wire contract runners are responsible for.
        .filter(|name| !name.starts_with("test/"))
        .collect();

    for suite_name in suite_names {
        run_suite(&client, base_url, &suite_name)
            .map_err(|error| format!("suite {suite_name}: {error}"))?;
    }
    Ok(())
}

fn run_suite(client: &reqwest::blocking::Client, base_url: &str, suite_name: &str) -> Result<(), String> {
    let body = serde_json::json!({ "suite": suite_name }).to_string();
    let session =
        post_json(client, &format!("{base_url}/__harness/sessions"), &body)?;

    let session_id = session["sessionId"]
        .as_str()
        .ok_or("session missing sessionId")?
        .to_string();
    let steps = session["steps"]
        .as_array()
        .ok_or("session missing steps")?
        .clone();

    for step in &steps {
        perform_step(client, base_url, &session_id, step)
            .map_err(|error| format!("step {}: {error}", step["id"]))?;
    }

    let report = post_json(
        client,
        &format!("{base_url}/__harness/sessions/{session_id}/complete"),
        "{}",
    )?;
    if report["pass"].as_bool() != Some(true) {
        return Err(format!("report failed:\n{report}"));
    }
    println!("suite {suite_name} passed ({} steps)", steps.len());
    Ok(())
}

fn perform_step(
    client: &reqwest::blocking::Client,
    base_url: &str,
    session_id: &str,
    step: &Value,
) -> Result<(), String> {
    let request = &step["request"];
    let method = request["method"]
        .as_str()
        .ok_or("step missing method")?
        .to_string();
    let path = request["path"].as_str().ok_or("step missing path")?;

    let mut headers: Vec<(String, String)> = Vec::new();
    if let Some(exact) = request["headers"].as_object() {
        for (name, value) in exact {
            if let Some(value) = value.as_str() {
                headers.push((name.to_lowercase(), value.to_string()));
            }
        }
    }
    if let Some(required) = request["requireHeaders"].as_array() {
        for header in required {
            if let Some(name) = header.as_str() {
                let lower = name.to_lowercase();
                if !headers.iter().any(|(existing, _)| *existing == lower) {
                    headers.push((lower, format!("conformance-{name}")));
                }
            }
        }
    }

    let has_body = request.get("body").is_some_and(|body| !body.is_null());
    let body_text = if has_body {
        headers.retain(|(name, _)| name != "content-type");
        headers.push(("content-type".into(), "application/json".into()));
        serde_json::to_string(&request["body"]).map_err(|error| error.to_string())?
    } else {
        String::new()
    };

    headers.push(("x-harness-session".into(), session_id.to_string()));

    let url = format!("{base_url}{path}");
    let mut builder = match method.as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "PATCH" => client.patch(&url),
        "DELETE" => client.delete(&url),
        other => return Err(format!("unsupported method {other}")),
    };
    for (name, value) in &headers {
        builder = builder.header(name, value);
    }

    let response = builder.body(body_text).send().map_err(|error| error.to_string())?;
    let status = response.status().as_u16();
    let response_body = response.text().map_err(|error| error.to_string())?;

    let expected_status = step["responses"][0]["status"].as_u64().unwrap_or(200);
    if status as u64 != expected_status {
        return Err(format!(
            "expected status {expected_status}, got {status}: {response_body}"
        ));
    }

    let expected_body = &step["responses"][0]["body"];
    if !expected_body.is_null() {
        let actual: Value =
            serde_json::from_str(&response_body).map_err(|error| error.to_string())?;
        if !json_matches(expected_body, &actual) {
            return Err(format!(
                "body mismatch\nexpected: {expected_body}\nactual: {response_body}"
            ));
        }
    }
    Ok(())
}

/// Structural JSON equality with a tiny float tolerance so number round-trips
/// across languages stay comparable.
fn json_matches(expected: &Value, actual: &Value) -> bool {
    match (expected, actual) {
        (Value::Null, Value::Null) => true,
        (Value::Bool(a), Value::Bool(b)) => a == b,
        (Value::String(a), Value::String(b)) => a == b,
        (Value::Number(a), Value::Number(b)) => {
            let a = a.as_f64().unwrap_or_default();
            let b = b.as_f64().unwrap_or_default();
            (a - b).abs() <= 1e-9 * f64::max(1.0, a.abs())
        }
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b.iter()).all(|(x, y)| json_matches(x, y))
        }
        (Value::Object(a), Value::Object(b)) => {
            a.len() == b.len()
                && a.iter()
                    .all(|(key, value)| b.get(key).is_some_and(|other| json_matches(value, other)))
        }
        _ => false,
    }
}

fn get_json(client: &reqwest::blocking::Client, url: &str) -> Result<Value, String> {
    let response = client
        .get(url)
        .header("content-type", "application/json")
        .send()
        .map_err(|error| error.to_string())?;
    response.json().map_err(|error| error.to_string())
}

fn post_json(client: &reqwest::blocking::Client, url: &str, body: &str) -> Result<Value, String> {
    let response = client
        .post(url)
        .header("content-type", "application/json")
        .body(body.to_string())
        .send()
        .map_err(|error| error.to_string())?;
    let status = response.status();
    let text = response.text().map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(format!("POST {url}: status {status}: {text}"));
    }
    serde_json::from_str(&text).map_err(|error| error.to_string())
}
