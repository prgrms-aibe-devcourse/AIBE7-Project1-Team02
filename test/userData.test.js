const test = require("node:test");
const assert = require("node:assert/strict");
const {
  deleteUserAccountData,
  deleteUserActivityData,
} = require("../src/services/supabase/userData");

function createSupabaseMock() {
  const operations = [];

  function createQuery(table) {
    const state = {
      table,
      action: "",
      filter: null,
    };

    const query = {
      select() {
        state.action = "select";
        return query;
      },
      delete() {
        state.action = "delete";
        return query;
      },
      eq(column, value) {
        state.filter = { type: "eq", column, value };
        return query;
      },
      in(column, values) {
        state.filter = { type: "in", column, values };
        return query;
      },
      then(resolve) {
        operations.push({
          table: state.table,
          action: state.action,
          filter: state.filter,
        });

        if (state.action === "select" && state.table === "community_posts") {
          return resolve({ data: [{ post_id: 11 }], error: null });
        }
        if (
          state.action === "select" &&
          state.table === "community_comments" &&
          state.filter?.column === "user_id"
        ) {
          return resolve({ data: [{ comment_id: 21 }], error: null });
        }
        if (
          state.action === "select" &&
          state.table === "community_comments"
        ) {
          return resolve({ data: [{ comment_id: 22 }], error: null });
        }
        if (state.action === "select" && state.table === "trips") {
          return resolve({ data: [{ trip_id: 31 }], error: null });
        }
        if (state.table === "itineraries") {
          return resolve({
            data: null,
            error: { code: "PGRST205", message: "relation not found" },
          });
        }

        return resolve({ data: [], error: null });
      },
    };

    return query;
  }

  return {
    client: {
      from(table) {
        return createQuery(table);
      },
    },
    operations,
  };
}

test("사용자 활동 초기화는 일정 항목을 일정 본문보다 먼저 삭제한다", async () => {
  const { client, operations } = createSupabaseMock();

  await deleteUserActivityData(client, "user-1");

  const itemDeleteIndex = operations.findIndex(
    ({ table, action }) =>
      table === "trip_plan_items" && action === "delete",
  );
  const planDeleteIndex = operations.findIndex(
    ({ table, action }) => table === "trip_plans" && action === "delete",
  );
  const tripDeleteIndex = operations.findIndex(
    ({ table, action }) => table === "trips" && action === "delete",
  );

  assert.ok(itemDeleteIndex >= 0);
  assert.ok(planDeleteIndex > itemDeleteIndex);
  assert.ok(tripDeleteIndex > planDeleteIndex);
});

test("선택 테이블이 없어도 사용자 활동 초기화를 계속 진행한다", async () => {
  const { client, operations } = createSupabaseMock();

  await assert.doesNotReject(() => deleteUserActivityData(client, "user-1"));
  assert.ok(
    operations.some(
      ({ table, action }) =>
        table === "user_preferences" && action === "delete",
    ),
  );
});

test("회원 탈퇴 데이터 정리는 약관 동의 이력까지 삭제한다", async () => {
  const { client, operations } = createSupabaseMock();

  await deleteUserAccountData(client, "user-1");

  assert.ok(
    operations.some(
      ({ table, action, filter }) =>
        table === "user_agreements" &&
        action === "delete" &&
        filter?.value === "user-1",
    ),
  );
});
