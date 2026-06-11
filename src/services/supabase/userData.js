const OPTIONAL_RELATION_ERROR_CODES = new Set(["42P01", "PGRST205"]);

function isOptionalRelationError(error) {
  return OPTIONAL_RELATION_ERROR_CODES.has(error?.code);
}

async function runQuery(query, label, { optional = false } = {}) {
  const { data, error } = await query;

  if (error && !(optional && isOptionalRelationError(error))) {
    error.userDataStep = label;
    throw error;
  }

  return data || [];
}

async function selectIds(
  supabaseClient,
  table,
  idColumn,
  filterColumn,
  filterValue,
  options = {},
) {
  const rows = await runQuery(
    supabaseClient
      .from(table)
      .select(idColumn)
      .eq(filterColumn, filterValue),
    `${table} 조회`,
    options,
  );

  return rows.map((row) => row[idColumn]).filter((value) => value != null);
}

async function deleteByUserId(
  supabaseClient,
  table,
  userId,
  options = {},
) {
  await runQuery(
    supabaseClient.from(table).delete().eq("user_id", userId),
    `${table} 삭제`,
    options,
  );
}

async function deleteByIds(
  supabaseClient,
  table,
  column,
  ids,
  options = {},
) {
  if (ids.length === 0) return;

  await runQuery(
    supabaseClient.from(table).delete().in(column, ids),
    `${table} 삭제`,
    options,
  );
}

async function deleteCommunityData(supabaseClient, userId) {
  const postIds = await selectIds(
    supabaseClient,
    "community_posts",
    "post_id",
    "user_id",
    userId,
    { optional: true },
  );
  const ownCommentIds = await selectIds(
    supabaseClient,
    "community_comments",
    "comment_id",
    "user_id",
    userId,
    { optional: true },
  );

  let postCommentIds = [];
  if (postIds.length > 0) {
    const rows = await runQuery(
      supabaseClient
        .from("community_comments")
        .select("comment_id")
        .in("post_id", postIds),
      "community_comments 조회",
      { optional: true },
    );
    postCommentIds = rows.map((row) => row.comment_id);
  }

  const commentIds = [...new Set([...ownCommentIds, ...postCommentIds])];

  await deleteByIds(
    supabaseClient,
    "community_comment_likes",
    "comment_id",
    commentIds,
    { optional: true },
  );
  await deleteByUserId(
    supabaseClient,
    "community_comment_likes",
    userId,
    { optional: true },
  );

  for (const table of ["community_likes", "community_shares"]) {
    await deleteByIds(supabaseClient, table, "post_id", postIds, {
      optional: true,
    });
    await deleteByUserId(supabaseClient, table, userId, { optional: true });
  }

  await deleteByIds(
    supabaseClient,
    "community_comments",
    "post_id",
    postIds,
    { optional: true },
  );
  await deleteByUserId(supabaseClient, "community_comments", userId, {
    optional: true,
  });
  await deleteByUserId(supabaseClient, "community_posts", userId, {
    optional: true,
  });
}

async function deleteTripData(supabaseClient, userId) {
  const tripIds = await selectIds(
    supabaseClient,
    "trips",
    "trip_id",
    "user_id",
    userId,
    { optional: true },
  );

  await deleteByUserId(supabaseClient, "trip_plan_items", userId, {
    optional: true,
  });
  await deleteByUserId(supabaseClient, "trip_plans", userId, {
    optional: true,
  });
  await deleteByIds(
    supabaseClient,
    "itineraries",
    "trip_id",
    tripIds,
    { optional: true },
  );
  await deleteByUserId(supabaseClient, "trips", userId, { optional: true });
}

async function deleteUserActivityData(supabaseClient, userId) {
  await deleteCommunityData(supabaseClient, userId);
  await deleteTripData(supabaseClient, userId);

  for (const table of [
    "user_bookmarks",
    "travel_mbti_results",
    "user_preferences",
  ]) {
    await deleteByUserId(supabaseClient, table, userId, { optional: true });
  }
}

async function deleteUserAccountData(supabaseClient, userId) {
  await deleteUserActivityData(supabaseClient, userId);
  await deleteByUserId(supabaseClient, "user_agreements", userId, {
    optional: true,
  });
}

module.exports = {
  deleteUserAccountData,
  deleteUserActivityData,
  isOptionalRelationError,
};
