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

import cats.effect.IO
import vinyldns.core.domain.membership.User
import vinyldns.core.health.HealthCheck._
import controllers.VinylDNS.UserDetails
import org.slf4j.LoggerFactory

class GraphAuthenticator(graphUserController: GraphUserController) extends Authenticator {

  private val logger = LoggerFactory.getLogger("GraphAuthenticator")
  // Password authentication is not supported for Graph API
  override def authenticate(username: String, password: String): Either[DirectoryException, UserDetails] =
    Left(GraphServiceException("Password authentication not supported with Microsoft Graph."))

  override def lookup(username: String): Either[DirectoryException, UserDetails] = {
    val user = graphUserController.lookup(username)
    logger.info(s"Graph lookup for user: $username: $user")
    user
  }

  override def getUsersNotInDirectory(users: List[User]): IO[List[User]] =
    IO {
      val notFound = graphUserController.getUsersNotInGraph(users.map(_.userName))
      users.filter(u => notFound.contains(u.userName))
    }

  override def healthCheck(): HealthCheck =
    IO(Right(())).asHealthCheck(classOf[GraphAuthenticator])
}
