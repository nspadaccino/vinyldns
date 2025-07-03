/*
 * Copyright 2018 Comcast Cable Communications Management, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package controllers

sealed trait DirectoryException extends Exception {
  def message: String
  override def getMessage: String = message
}

final case class UserDoesNotExistException(message: String) extends DirectoryException
final case class LdapServiceException(errorMessage: String)
  extends DirectoryException { val message = s"LDAP service error: $errorMessage" }
final case class InvalidCredentialsException(username: String)
  extends DirectoryException { val message = s"Invalid credentials for user [$username]." }
final case object NoSearchDomainsConfiguredException
  extends DirectoryException { val message = "No search domains configured for directory lookup." }
final case class GraphServiceException(errorMessage: String)
  extends DirectoryException { val message = s"Microsoft Graph service error: $errorMessage" }
