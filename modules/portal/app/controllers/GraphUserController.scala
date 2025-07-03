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

import com.azure.identity.ClientSecretCredentialBuilder
import com.microsoft.graph.serviceclient.GraphServiceClient
import com.microsoft.graph.models.User
import com.microsoft.kiota.ApiException
import controllers.VinylDNS.UserDetails
import org.slf4j.LoggerFactory

import scala.jdk.CollectionConverters._

case class GraphUserDetails(
                             username: String,
                             email: Option[String],
                             firstName: Option[String],
                             lastName: Option[String],
                             id: Option[String] = None
                           ) extends UserDetails

class GraphUserController(
                           tenantId: String,
                           clientId: String,
                           clientSecret: String
                         ) {

  private val logger = LoggerFactory.getLogger("GraphUserController")

  private val credential = new ClientSecretCredentialBuilder()
    .tenantId(tenantId)
    .clientId(clientId)
    .clientSecret(clientSecret)
    .build()

  private val scopes = List("https://graph.microsoft.com/.default")

  private val graphClient = new GraphServiceClient(credential, scopes: _*)

  def lookup(username: String): Either[DirectoryException, GraphUserDetails] = {
    val selectFields = Array("userPrincipalName", "mail", "givenName", "surname", "id")
    logger.info(s"Looking up user in Microsoft Graph: $username")
    logger.debug(s"Using select fields: ${selectFields.mkString(",")}")

    try {
      val user: User = graphClient
        .users()
        .byUserId(username)
        .get(requestConfig => {
          requestConfig.queryParameters.select = selectFields
        })

      logger.info(s"Graph API returned user: " +
        s"userPrincipalName=${user.getUserPrincipalName}, " +
        s"mail=${user.getMail}, " +
        s"givenName=${user.getGivenName}, " +
        s"surname=${user.getSurname}, " +
        s"id=${user.getId}")

      Right(
        GraphUserDetails(
          username = Option(user.getUserPrincipalName).getOrElse(username),
          email = Option(user.getMail),
          firstName = Option(user.getGivenName),
          lastName = Option(user.getSurname),
          id = Option(user.getId)
        )
      )
    } catch {
      case ex: ApiException =>
        logger.error(
          s"Graph API exception for user '$username': status=${ex.getResponseStatusCode}, message=${ex.getMessage}",
          ex
        )
        if (ex.getResponseStatusCode == 404)
          Left(UserDoesNotExistException(s"User $username not found in Microsoft Graph"))
        else
          Left(GraphServiceException(s"Graph API error for $username: status=${ex.getResponseStatusCode}, message=${ex.getMessage}"))
      case ex: Exception =>
        logger.error(s"Unexpected exception during Graph lookup for user '$username': ${ex.getMessage}", ex)
        Left(GraphServiceException(s"Graph API error for $username: ${ex.getMessage}"))
    }
  }

  def getUsersNotInGraph(usernames: List[String]): List[String] = {
    usernames.par.filter { username =>
      val result = lookup(username)
      logger.info(s"Lookup result for $username: $result")
      result.isLeft
    }.toList
  }
}
