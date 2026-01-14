/**
 * GitHub Repos Route
 * Lists repositories accessible by the authenticated user
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { githubRequest, getGitHubToken } from "@/lib/github";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = await getGitHubToken({ userId: session.user.id });
    
    if (!token) {
      return NextResponse.json(
        { code: "NOT_CONNECTED", message: "GitHub not connected" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const org = searchParams.get("org");
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("perPage") || "30");

    let endpoint;
    if (org) {
      endpoint = `/orgs/${org}/repos?page=${page}&per_page=${perPage}&sort=updated`;
    } else {
      endpoint = `/user/repos?page=${page}&per_page=${perPage}&sort=updated&affiliation=owner,collaborator,organization_member`;
    }

    const repos = await githubRequest(endpoint, { token });

    // Transform to match expected schema
    const formattedRepos = repos.map((repo) => ({
      id: repo.id.toString(),
      name: repo.name,
      owner: repo.owner.login,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      defaultBranch: repo.default_branch,
      url: repo.html_url,
      updatedAt: repo.updated_at,
      language: repo.language,
      stargazersCount: repo.stargazers_count,
    }));

    return NextResponse.json({
      repos: formattedRepos,
      total: formattedRepos.length,
    });
  } catch (error) {
    console.error("GitHub repos error:", error);
    return NextResponse.json(
      { code: "GITHUB_ERROR", message: error.message },
      { status: 500 }
    );
  }
}
