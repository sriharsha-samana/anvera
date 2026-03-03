#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:4000}"
OWNER_USERNAME="${OWNER_USERNAME:-owner}"
OWNER_PASSWORD="${OWNER_PASSWORD:-owner123}"
OWNER_EMAIL="${OWNER_EMAIL:-owner@example.com}"
OWNER_PHONE="${OWNER_PHONE:-+919900000001}"
MEMBER_USERNAME="${MEMBER_USERNAME:-member}"
MEMBER_PASSWORD="${MEMBER_PASSWORD:-member123}"
MEMBER_EMAIL="${MEMBER_EMAIL:-member@example.com}"
MEMBER_PHONE="${MEMBER_PHONE:-+919900000002}"
FAMILY_NAME="${FAMILY_NAME:-Smoke Family $(date +%s)}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd jq
require_cmd docker-compose

echo "[1/10] Upserting smoke users in backend DB..."
docker-compose exec -T backend node -e "const {PrismaClient}=require('@prisma/client'); const bcrypt=require('bcryptjs'); (async()=>{const p=new PrismaClient(); const ownerHash=await bcrypt.hash('$OWNER_PASSWORD',10); const memberHash=await bcrypt.hash('$MEMBER_PASSWORD',10); await p.user.upsert({where:{username:'$OWNER_USERNAME'},update:{passwordHash:ownerHash,role:'OWNER',email:'$OWNER_EMAIL',phone:'$OWNER_PHONE',givenName:'Owner',familyName:'User',gender:'unknown'},create:{username:'$OWNER_USERNAME',passwordHash:ownerHash,role:'OWNER',email:'$OWNER_EMAIL',phone:'$OWNER_PHONE',givenName:'Owner',familyName:'User',gender:'unknown'}}); await p.user.upsert({where:{username:'$MEMBER_USERNAME'},update:{passwordHash:memberHash,role:'MEMBER',email:'$MEMBER_EMAIL',phone:'$MEMBER_PHONE',givenName:'Member',familyName:'User',gender:'unknown'},create:{username:'$MEMBER_USERNAME',passwordHash:memberHash,role:'MEMBER',email:'$MEMBER_EMAIL',phone:'$MEMBER_PHONE',givenName:'Member',familyName:'User',gender:'unknown'}}); await p.\$disconnect(); console.log('users-upserted');})().catch((e)=>{console.error(e);process.exit(1);});" >/dev/null

echo "[2/10] Health check..."
HEALTH_JSON="$(curl -sS "${API_BASE_URL}/health")"
echo "$HEALTH_JSON" | jq -e '.ok == true' >/dev/null

echo "[3/10] Logging in owner and member..."
OWNER_LOGIN="$(curl -sS -X POST "${API_BASE_URL}/auth/login" -H 'Content-Type: application/json' -d "{\"identifier\":\"${OWNER_USERNAME}\",\"password\":\"${OWNER_PASSWORD}\"}")"
OWNER_TOKEN="$(echo "$OWNER_LOGIN" | jq -r '.token')"
[[ "$OWNER_TOKEN" != "null" && -n "$OWNER_TOKEN" ]]

MEMBER_LOGIN="$(curl -sS -X POST "${API_BASE_URL}/auth/login" -H 'Content-Type: application/json' -d "{\"identifier\":\"${MEMBER_USERNAME}\",\"password\":\"${MEMBER_PASSWORD}\"}")"
MEMBER_TOKEN="$(echo "$MEMBER_LOGIN" | jq -r '.token')"
[[ "$MEMBER_TOKEN" != "null" && -n "$MEMBER_TOKEN" ]]

echo "[4/10] Creating family..."
CREATE_FAMILY="$(curl -sS -X POST "${API_BASE_URL}/families" -H "Authorization: Bearer ${OWNER_TOKEN}" -H 'Content-Type: application/json' -d "{\"name\":\"${FAMILY_NAME}\"}")"
FAMILY_ID="$(echo "$CREATE_FAMILY" | jq -r '.id')"
[[ "$FAMILY_ID" != "null" && -n "$FAMILY_ID" ]]

echo "[5/10] Linking member to family..."
MEMBER_ID="$(docker-compose exec -T backend node -e "const {PrismaClient}=require('@prisma/client');(async()=>{const p=new PrismaClient();const u=await p.user.findUnique({where:{username:'$MEMBER_USERNAME'}});console.log(u.id);await p.\$disconnect();})();" | tail -n 1 | tr -d '\r')"

docker-compose exec -T backend node -e "const {PrismaClient}=require('@prisma/client');(async()=>{const p=new PrismaClient();await p.familyMember.upsert({where:{familyId_userId:{familyId:'$FAMILY_ID',userId:'$MEMBER_ID'}},update:{},create:{familyId:'$FAMILY_ID',userId:'$MEMBER_ID'}});await p.\$disconnect();console.log('membership-linked');})();" >/dev/null

echo "[6/10] Submitting member proposal..."
PROPOSAL="$(curl -sS -X POST "${API_BASE_URL}/families/${FAMILY_ID}/proposals" -H "Authorization: Bearer ${MEMBER_TOKEN}" -H 'Content-Type: application/json' -d '{"type":"ADD_PERSON","data":{"name":"Smoke Proposed Person","givenName":"Smoke","familyName":"Proposed","gender":"female","email":"smoke.proposed@example.com"}}')"
PROPOSAL_ID="$(echo "$PROPOSAL" | jq -r '.id')"
PROPOSAL_STATUS="$(echo "$PROPOSAL" | jq -r '.status')"
[[ "$PROPOSAL_STATUS" == "PENDING" ]]

echo "[7/10] Approving proposal and rolling back..."
APPROVED="$(curl -sS -X POST "${API_BASE_URL}/proposals/${PROPOSAL_ID}/approve" -H "Authorization: Bearer ${OWNER_TOKEN}")"
APPROVED_STATUS="$(echo "$APPROVED" | jq -r '.status')"
APPLIED_VERSION="$(echo "$APPROVED" | jq -r '.appliedVersionNumber')"
[[ "$APPROVED_STATUS" == "APPROVED" ]]

VERSIONS="$(curl -sS "${API_BASE_URL}/families/${FAMILY_ID}/versions" -H "Authorization: Bearer ${OWNER_TOKEN}")"
ROLLBACK_TARGET="$(echo "$VERSIONS" | jq -r '.[].versionNumber' | sort -n | head -n1)"
ROLLBACK="$(curl -sS -X POST "${API_BASE_URL}/families/${FAMILY_ID}/rollback/${ROLLBACK_TARGET}" -H "Authorization: Bearer ${OWNER_TOKEN}")"
ROLLBACK_VERSION="$(echo "$ROLLBACK" | jq -r '.versionNumber')"
[[ "$ROLLBACK_VERSION" != "null" && -n "$ROLLBACK_VERSION" ]]

echo "[8/10] Verifying overridden proposal marker..."
PROPOSALS_AFTER="$(curl -sS "${API_BASE_URL}/families/${FAMILY_ID}/proposals" -H "Authorization: Bearer ${OWNER_TOKEN}")"
OVERRIDDEN_BY="$(echo "$PROPOSALS_AFTER" | jq -r '.[0].overriddenByVersionNumber')"
[[ "$OVERRIDDEN_BY" == "$ROLLBACK_VERSION" ]]

echo "[9/10] Verifying owner edit/delete person/relationship..."
P1_JSON="$(curl -sS -X POST "${API_BASE_URL}/families/${FAMILY_ID}/persons" -H "Authorization: Bearer ${OWNER_TOKEN}" -H 'Content-Type: application/json' -d '{"name":"Edit Smoke One","givenName":"Edit","familyName":"One","gender":"male","email":"edit.one@example.com"}')"
P2_JSON="$(curl -sS -X POST "${API_BASE_URL}/families/${FAMILY_ID}/persons" -H "Authorization: Bearer ${OWNER_TOKEN}" -H 'Content-Type: application/json' -d '{"name":"Edit Smoke Two","givenName":"Edit","familyName":"Two","gender":"female","email":"edit.two@example.com"}')"
P1_ID="$(echo "$P1_JSON" | jq -r '.id')"
P2_ID="$(echo "$P2_JSON" | jq -r '.id')"
[[ "$P1_ID" != "null" && -n "$P1_ID" ]]
[[ "$P2_ID" != "null" && -n "$P2_ID" ]]

REL_JSON="$(curl -sS -X POST "${API_BASE_URL}/families/${FAMILY_ID}/relationships" -H "Authorization: Bearer ${OWNER_TOKEN}" -H 'Content-Type: application/json' -d "{\"fromPersonId\":\"${P1_ID}\",\"toPersonId\":\"${P2_ID}\",\"type\":\"SIBLING\"}")"
REL_ID="$(echo "$REL_JSON" | jq -r '.id')"
[[ "$REL_ID" != "null" && -n "$REL_ID" ]]

UPDATED_PERSON="$(curl -sS -X PUT "${API_BASE_URL}/families/${FAMILY_ID}/persons/${P1_ID}" -H "Authorization: Bearer ${OWNER_TOKEN}" -H 'Content-Type: application/json' -d '{"name":"Edit Smoke One Updated","givenName":"Edit","familyName":"Updated","gender":"male","email":"edit.one.updated@example.com"}')"
UPDATED_PERSON_NAME="$(echo "$UPDATED_PERSON" | jq -r '.name')"
[[ "$UPDATED_PERSON_NAME" == "Edit Smoke One Updated" ]]

UPDATED_REL="$(curl -sS -X PUT "${API_BASE_URL}/families/${FAMILY_ID}/relationships/${REL_ID}" -H "Authorization: Bearer ${OWNER_TOKEN}" -H 'Content-Type: application/json' -d "{\"fromPersonId\":\"${P1_ID}\",\"toPersonId\":\"${P2_ID}\",\"type\":\"INLAW\"}")"
UPDATED_REL_TYPE="$(echo "$UPDATED_REL" | jq -r '.type')"
[[ "$UPDATED_REL_TYPE" == "INLAW" ]]

REL_DELETE_CODE="$(curl -sS -o /tmp/smoke_rel_delete_body.json -w '%{http_code}' -X DELETE "${API_BASE_URL}/families/${FAMILY_ID}/relationships/${REL_ID}" -H "Authorization: Bearer ${OWNER_TOKEN}")"
[[ "$REL_DELETE_CODE" == "204" ]]

PERSON_DELETE_CODE="$(curl -sS -o /tmp/smoke_person_delete_body.json -w '%{http_code}' -X DELETE "${API_BASE_URL}/families/${FAMILY_ID}/persons/${P2_ID}" -H "Authorization: Bearer ${OWNER_TOKEN}")"
[[ "$PERSON_DELETE_CODE" == "204" ]]

echo "[10/10] Verifying bad relationship validation (cycle + contradiction)..."
C1_JSON="$(curl -sS -X POST "${API_BASE_URL}/families/${FAMILY_ID}/persons" -H "Authorization: Bearer ${OWNER_TOKEN}" -H 'Content-Type: application/json' -d '{"name":"Cycle One","givenName":"Cycle","familyName":"One","gender":"male","email":"cycle.one@example.com"}')"
C2_JSON="$(curl -sS -X POST "${API_BASE_URL}/families/${FAMILY_ID}/persons" -H "Authorization: Bearer ${OWNER_TOKEN}" -H 'Content-Type: application/json' -d '{"name":"Cycle Two","givenName":"Cycle","familyName":"Two","gender":"female","email":"cycle.two@example.com"}')"
C1_ID="$(echo "$C1_JSON" | jq -r '.id')"
C2_ID="$(echo "$C2_JSON" | jq -r '.id')"
[[ "$C1_ID" != "null" && -n "$C1_ID" ]]
[[ "$C2_ID" != "null" && -n "$C2_ID" ]]

curl -sS -X POST "${API_BASE_URL}/families/${FAMILY_ID}/relationships" \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"fromPersonId\":\"${C1_ID}\",\"toPersonId\":\"${C2_ID}\",\"type\":\"PARENT\"}" >/dev/null

CYCLE_CODE="$(curl -sS -o /tmp/smoke_cycle_body.json -w '%{http_code}' -X POST "${API_BASE_URL}/families/${FAMILY_ID}/relationships" -H "Authorization: Bearer ${OWNER_TOKEN}" -H 'Content-Type: application/json' -d "{\"fromPersonId\":\"${C2_ID}\",\"toPersonId\":\"${C1_ID}\",\"type\":\"PARENT\"}")"
[[ "$CYCLE_CODE" == "400" ]]
grep -q "Invalid parent relationship" /tmp/smoke_cycle_body.json

SPOUSE_CODE="$(curl -sS -o /tmp/smoke_spouse_conflict_body.json -w '%{http_code}' -X POST "${API_BASE_URL}/families/${FAMILY_ID}/relationships" -H "Authorization: Bearer ${OWNER_TOKEN}" -H 'Content-Type: application/json' -d "{\"fromPersonId\":\"${C1_ID}\",\"toPersonId\":\"${C2_ID}\",\"type\":\"SPOUSE\"}")"
[[ "$SPOUSE_CODE" == "400" ]]
grep -q "Conflicting relationship already exists" /tmp/smoke_spouse_conflict_body.json

cat <<OUT

Smoke test PASSED
- API: ${API_BASE_URL}
- Family ID: ${FAMILY_ID}
- Proposal ID: ${PROPOSAL_ID}
- Applied Version: ${APPLIED_VERSION}
- Rollback Target: ${ROLLBACK_TARGET}
- Rollback Version: ${ROLLBACK_VERSION}
- Overridden Marker: ${OVERRIDDEN_BY}
- Edit/Delete Person ID: ${P1_ID}
- Edit/Delete Relationship ID: ${REL_ID}
- Cycle Validation HTTP: ${CYCLE_CODE}
- Contradiction Validation HTTP: ${SPOUSE_CODE}
OUT
