"use client";

export default function UsersPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
        <p className="text-sm text-gray-500">User management (v1: GitHub OAuth users)</p>
      </header>
      <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-600">
        Users are created automatically on GitHub OAuth sign-in. Role management can be extended
        in a future release.
      </div>
    </div>
  );
}
